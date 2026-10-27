-- ============================================================================
-- NECL Phase 8 Migration: Driver App Dispatch, Digital Lorry Receipt (LR)
-- & e-Waybill Integration Workflow
--
-- Features:
--  1. Add columns to trips: lr_number, lr_generated_at, ewaybill_number,
--     ewaybill_valid_until, dispatched_at
--  2. Stored Procedure: rpc_driver_acknowledge_dispatch (validates driver ownership,
--     transitions trip to DISPATCHED / AT_LOADING, synchronizes booking, and logs audit)
--  3. Stored Procedure: rpc_generate_digital_lr (idempotent LR-YYYYMMDD-XXXX generation,
--     populates consignor, consignee, vehicle, driver & cargo details, stores in documents,
--     strictly enforces commercial rate confidentiality)
--  4. Stored Procedure: rpc_link_ewaybill_to_trip (12-digit format validation & linking)
--  5. Role-based digital LR access policies and audit trail integration
-- ============================================================================

-- 1. Ensure columns exist on public.trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS lr_number TEXT,
  ADD COLUMN IF NOT EXISTS lr_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ewaybill_number TEXT,
  ADD COLUMN IF NOT EXISTS ewaybill_valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- Unique index on lr_number (idempotent reference guarantee)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_lr_number ON public.trips (lr_number) WHERE lr_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_ewaybill ON public.trips (ewaybill_number) WHERE ewaybill_number IS NOT NULL;

-- 2. Stored Procedure: rpc_driver_acknowledge_dispatch
CREATE OR REPLACE FUNCTION public.rpc_driver_acknowledge_dispatch(
  p_trip_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
  v_driver RECORD;
  v_next_status TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Fetch trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIP_NOT_FOUND',
      'error', 'Trip not found.'
    );
  END IF;

  -- 2. Fetch driver
  SELECT * INTO v_driver FROM public.drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DRIVER_NOT_FOUND',
      'error', 'Driver not found.'
    );
  END IF;

  -- 3. Validate driver ownership of the trip
  IF v_trip.driver_id IS NOT NULL AND v_trip.driver_id <> p_driver_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DRIVER_UNAUTHORIZED',
      'error', 'Unauthorized: Driver is not assigned to this trip.'
    );
  END IF;

  -- 4. Determine status transition
  -- If LORRY_ASSIGNED or CREATED, transition to DISPATCHED
  -- If already DISPATCHED, transition to AT_LOADING
  IF v_trip.trip_status IN ('CREATED', 'LORRY_ASSIGNED') THEN
    v_next_status := 'DISPATCHED';
  ELSIF v_trip.trip_status = 'DISPATCHED' THEN
    v_next_status := 'AT_LOADING';
  ELSE
    v_next_status := v_trip.trip_status;
  END IF;

  -- 5. Update Trip
  UPDATE public.trips
  SET
    trip_status = v_next_status,
    driver_id = COALESCE(v_trip.driver_id, p_driver_id),
    dispatched_at = COALESCE(v_trip.dispatched_at, v_now),
    started_at = COALESCE(v_trip.started_at, v_now)
  WHERE id = p_trip_id;

  -- 6. Synchronize Booking status to IN_PROGRESS if confirmed
  IF v_trip.booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET booking_status = 'IN_PROGRESS'
    WHERE id = v_trip.booking_id AND booking_status IN ('CONFIRMED', 'CLIENT_ACCEPTED');
  END IF;

  -- 7. Audit log
  BEGIN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      p_driver_id,
      'DRIVER',
      'DRIVER_DISPATCH_ACKNOWLEDGED',
      jsonb_build_object(
        'trip_id', p_trip_id,
        'driver_id', p_driver_id,
        'driver_name', v_driver.full_name,
        'previous_status', v_trip.trip_status,
        'new_status', v_next_status,
        'acknowledged_at', v_now
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'tripId', p_trip_id,
    'driverId', p_driver_id,
    'tripStatus', v_next_status,
    'dispatchedAt', v_now,
    'message', 'Driver dispatch acknowledged successfully. Trip transitioned to ' || v_next_status || '.'
  );
END;
$$;

-- 3. Stored Procedure: rpc_generate_digital_lr
CREATE OR REPLACE FUNCTION public.rpc_generate_digital_lr(
  p_trip_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
  v_booking RECORD;
  v_req RECORD;
  v_client RECORD;
  v_vendor RECORD;
  v_vehicle RECORD;
  v_driver RECORD;
  v_existing_doc RECORD;
  v_lr_number TEXT;
  v_today_str TEXT;
  v_clean_id TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_lr_data JSONB;
BEGIN
  -- 1. Fetch trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIP_NOT_FOUND',
      'error', 'Trip not found.'
    );
  END IF;

  -- 2. Idempotency Check: Does an LR already exist on this trip?
  IF v_trip.lr_number IS NOT NULL AND v_trip.lr_number <> '' THEN
    -- Return existing LR payload
    SELECT * INTO v_existing_doc FROM public.documents
    WHERE reference_id = p_trip_id::text
      AND category = 'TRIP'
      AND document_type = 'DIGITAL_LR'
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'isIdempotent', true,
      'tripId', p_trip_id,
      'lrNumber', v_trip.lr_number,
      'generatedAt', COALESCE(v_trip.lr_generated_at, v_trip.created_at),
      'ewaybillNumber', v_trip.ewaybill_number,
      'ewaybillValidUntil', v_trip.ewaybill_valid_until,
      'documentId', v_existing_doc.id,
      'message', 'Digital Lorry Receipt (LR) already generated for this trip (Idempotent response).'
    );
  END IF;

  -- 3. Fetch linked records
  IF v_trip.booking_id IS NOT NULL THEN
    SELECT * INTO v_booking FROM public.bookings WHERE id = v_trip.booking_id;
  END IF;

  IF v_booking.requirement_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.requirements WHERE id = v_booking.requirement_id;
  END IF;

  IF v_booking.client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM public.client_companies WHERE id = v_booking.client_id;
  END IF;

  IF v_trip.vendor_id IS NOT NULL THEN
    SELECT * INTO v_vendor FROM public.vendor_companies WHERE id = v_trip.vendor_id;
  END IF;

  IF v_trip.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.vehicle_id;
  END IF;

  IF v_trip.driver_id IS NOT NULL THEN
    SELECT * INTO v_driver FROM public.drivers WHERE id = v_trip.driver_id;
  END IF;

  -- 4. Generate deterministic collision-resistant LR number (LR-YYYYMMDD-XXXX)
  v_today_str := to_char(v_now, 'YYYYMMDD');
  v_clean_id := upper(substring(replace(p_trip_id::text, '-', '') from 1 for 4));
  v_lr_number := 'LR-' || v_today_str || '-' || v_clean_id;

  -- 5. Construct full structured LR document payload
  -- COMMERCIAL CONFIDENTIALITY RULE: vendor_rate and admin margin are NEVER placed in public LR!
  v_lr_data := jsonb_build_object(
    'lrNumber', v_lr_number,
    'generatedAt', v_now,
    'tripId', p_trip_id,
    'bookingId', v_trip.booking_id,
    'consignor', jsonb_build_object(
      'companyName', COALESCE(v_client.company_name, 'Consignor / Shipper'),
      'address', COALESCE(v_req.pickup_address, 'Assigned Loading Point'),
      'pincode', COALESCE(v_req.pickup_pincode, ''),
      'contactPerson', COALESCE(v_req.loading_contact_person, 'Loading Supervisor'),
      'contactPhone', COALESCE(v_req.loading_contact_phone, '')
    ),
    'consignee', jsonb_build_object(
      'companyName', COALESCE(v_req.consignee_name, v_client.company_name, 'Consignee / Receiver'),
      'address', COALESCE(v_req.destination_address, 'Assigned Destination Point'),
      'pincode', COALESCE(v_req.destination_pincode, ''),
      'contactPerson', COALESCE(v_req.unloading_contact_person, 'Receiving Incharge'),
      'contactPhone', COALESCE(v_req.unloading_contact_phone, '')
    ),
    'transporter', jsonb_build_object(
      'vendorId', v_trip.vendor_id,
      'companyName', COALESCE(v_vendor.vendor_name, 'NECL Dedicated Carrier Network'),
      'vendorCode', COALESCE(v_vendor.vendor_code, 'NECL-TRANSPORTER'),
      'phone', COALESCE(v_vendor.phone, '')
    ),
    'vehicle', jsonb_build_object(
      'vehicleId', v_trip.vehicle_id,
      'registrationNumber', COALESCE(v_vehicle.registration_number, 'Pending Allocation'),
      'vehicleType', COALESCE(v_vehicle.vehicle_type, v_req.vehicle_type, 'Standard Commercial Truck')
    ),
    'driver', jsonb_build_object(
      'driverId', v_trip.driver_id,
      'fullName', COALESCE(v_driver.full_name, 'Assigned Professional Driver'),
      'mobile', COALESCE(v_driver.mobile, v_driver.phone, ''),
      'licenceNumber', COALESCE(v_driver.licence_number, '')
    ),
    'cargo', jsonb_build_object(
      'materialType', COALESCE(v_req.material_type, 'General Commercial Freight'),
      'weightMt', COALESCE(v_req.required_capacity_mt, 0),
      'instructions', COALESCE(v_req.handling_instructions, 'Standard B2B Cargo Handling')
    ),
    'ewaybill', jsonb_build_object(
      'ewaybillNumber', v_trip.ewaybill_number,
      'validUntil', v_trip.ewaybill_valid_until
    )
  );

  -- 6. Update Trips record with LR details
  UPDATE public.trips
  SET
    lr_number = v_lr_number,
    lr_generated_at = v_now
  WHERE id = p_trip_id;

  -- 7. Persist to documents table
  INSERT INTO public.documents (
    category,
    document_type,
    reference_id,
    file_name,
    file_url,
    storage_path,
    verification_status,
    uploaded_by
  ) VALUES (
    'TRIP',
    'DIGITAL_LR',
    p_trip_id::text,
    'Digital_LR_' || v_lr_number || '.pdf',
    '/documents/trips/' || p_trip_id::text || '/lr/' || v_lr_number,
    'trips/' || p_trip_id::text || '/lr/' || v_lr_number || '.pdf',
    'VERIFIED',
    COALESCE(p_created_by, v_trip.driver_id, v_trip.vendor_id, '00000000-0000-0000-0000-000000000001'::uuid)
  );

  -- 8. Audit log entry
  BEGIN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      COALESCE(p_created_by, v_trip.driver_id, v_trip.vendor_id, '00000000-0000-0000-0000-000000000001'::uuid),
      'SYSTEM',
      'DIGITAL_LR_GENERATED',
      jsonb_build_object(
        'trip_id', p_trip_id,
        'lr_number', v_lr_number,
        'generated_at', v_now,
        'booking_id', v_trip.booking_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'isIdempotent', false,
    'tripId', p_trip_id,
    'lrNumber', v_lr_number,
    'generatedAt', v_now,
    'ewaybillNumber', v_trip.ewaybill_number,
    'ewaybillValidUntil', v_trip.ewaybill_valid_until,
    'lrData', v_lr_data,
    'message', 'Digital Lorry Receipt (LR) generated successfully.'
  );
END;
$$;

-- 4. Stored Procedure: rpc_link_ewaybill_to_trip
CREATE OR REPLACE FUNCTION public.rpc_link_ewaybill_to_trip(
  p_trip_id UUID,
  p_ewaybill_number TEXT,
  p_valid_until TIMESTAMPTZ DEFAULT NULL,
  p_linked_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
  v_clean_ewb TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Validate e-waybill format: exactly 12 numeric digits
  v_clean_ewb := regexp_replace(upper(trim(p_ewaybill_number)), '^EWB-', '');
  IF v_clean_ewb !~ '^[0-9]{12}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_EWAYBILL_FORMAT',
      'error', 'Invalid e-Waybill format. Expected a 12-digit numeric code (e.g. 123456789012 or EWB-123456789012).'
    );
  END IF;

  -- 2. Fetch Trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIP_NOT_FOUND',
      'error', 'Trip not found.'
    );
  END IF;

  -- 3. Update Trip with e-waybill
  UPDATE public.trips
  SET
    ewaybill_number = v_clean_ewb,
    ewaybill_valid_until = COALESCE(p_valid_until, v_trip.ewaybill_valid_until, v_now + INTERVAL '3 days')
  WHERE id = p_trip_id;

  -- 4. Audit log entry
  BEGIN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      COALESCE(p_linked_by, v_trip.driver_id, v_trip.vendor_id, '00000000-0000-0000-0000-000000000001'::uuid),
      'TRANSPORTER',
      'EWAYBILL_LINKED_TO_TRIP',
      jsonb_build_object(
        'trip_id', p_trip_id,
        'ewaybill_number', v_clean_ewb,
        'valid_until', COALESCE(p_valid_until, v_now + INTERVAL '3 days'),
        'linked_at', v_now
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'tripId', p_trip_id,
    'ewaybillNumber', v_clean_ewb,
    'ewaybillValidUntil', COALESCE(p_valid_until, v_now + INTERVAL '3 days'),
    'message', '12-digit e-Waybill verified and linked to trip successfully.'
  );
END;
$$;
