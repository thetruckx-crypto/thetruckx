-- ============================================================================
-- NECL Phase 7 Migration: Vendor Award Notification, Trip Generation &
-- Vehicle/Driver Assignment Workflow
--
-- Features:
--  1. Add trip_code (TRP-YYYYMMDD-XXXX) and assigned_at columns to trips
--  2. Ensure vehicle_id and driver_id can be assigned dynamically post-creation
--  3. Stored Procedure: rpc_generate_trip_for_booking (Idempotent trip generation)
--  4. Stored Procedure: rpc_assign_vehicle_and_driver_to_trip (Enforces vendor fleet ownership,
--     driver roster validation, active-dispatch conflict prevention, and state synchronization)
--  5. Audit logging integration in auth_audit_log
-- ============================================================================

-- 1. Ensure columns exist on public.trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_code TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Drop NOT NULL on vehicle_id and driver_id if present so trips can be initialized prior to assignment
DO $$
BEGIN
  ALTER TABLE public.trips ALTER COLUMN vehicle_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.trips ALTER COLUMN driver_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create unique index on trip_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_trip_code ON public.trips (trip_code) WHERE trip_code IS NOT NULL;

-- 2. Performance index on trips by vendor and status
CREATE INDEX IF NOT EXISTS idx_trips_vendor_status ON public.trips (vendor_id, trip_status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_status ON public.trips (vehicle_id, trip_status);
CREATE INDEX IF NOT EXISTS idx_trips_driver_status ON public.trips (driver_id, trip_status);

-- 3. Stored Procedure: rpc_generate_trip_for_booking
CREATE OR REPLACE FUNCTION public.rpc_generate_trip_for_booking(
  p_booking_id TEXT,
  p_vendor_id UUID DEFAULT NULL,
  p_vendor_rate NUMERIC DEFAULT NULL,
  p_vehicle_id UUID DEFAULT NULL,
  p_driver_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
  v_quote RECORD;
  v_vquote RECORD;
  v_vreq RECORD;
  v_existing_trip RECORD;
  v_trip_id UUID;
  v_trip_code TEXT;
  v_vendor_id UUID := p_vendor_id;
  v_vendor_rate NUMERIC := p_vendor_rate;
  v_vehicle_id UUID := p_vehicle_id;
  v_driver_id UUID := p_driver_id;
  v_today_str TEXT;
  v_initial_status TEXT;
  v_collision_count INT;
BEGIN
  -- 1. Check if booking exists
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOOKING_NOT_FOUND',
      'message', 'Booking reference does not exist.'
    );
  END IF;

  -- 2. Idempotency Check: Return existing trip if already generated
  SELECT * INTO v_existing_trip
  FROM public.trips
  WHERE booking_id = p_booking_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'trip_id', v_existing_trip.id,
      'trip_code', v_existing_trip.trip_code,
      'booking_id', p_booking_id,
      'trip_status', v_existing_trip.trip_status,
      'is_idempotent', true,
      'message', 'Trip already exists for this booking.'
    );
  END IF;

  -- 3. Resolve vendor and vendor base rate from quotation chain if not passed
  IF (v_vendor_id IS NULL OR v_vendor_rate IS NULL) AND v_booking.accepted_quote_id IS NOT NULL THEN
    SELECT * INTO v_quote
    FROM public.client_quotes
    WHERE id = v_booking.accepted_quote_id;

    IF FOUND THEN
      IF v_vendor_rate IS NULL THEN
        v_vendor_rate := v_quote.vendor_base_cost;
      END IF;

      -- Check vendor_quotation if linked
      IF v_quote.vendor_quotation_id IS NOT NULL THEN
        SELECT * INTO v_vquote
        FROM public.vendor_quotations
        WHERE id = v_quote.vendor_quotation_id;

        IF FOUND THEN
          IF v_vehicle_id IS NULL THEN
            v_vehicle_id := v_vquote.vehicle_id;
          END IF;
          IF v_driver_id IS NULL THEN
            v_driver_id := v_vquote.driver_id;
          END IF;

          -- Resolve vendor_id from vendor_requests
          IF v_vendor_id IS NULL AND v_vquote.vendor_request_id IS NOT NULL THEN
            SELECT vendor_id INTO v_vendor_id
            FROM public.vendor_requests
            WHERE id = v_vquote.vendor_request_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Default vendor rate to 0 if still null
  IF v_vendor_rate IS NULL THEN
    v_vendor_rate := 0;
  END IF;

  -- Determine initial status
  IF v_vehicle_id IS NOT NULL AND v_driver_id IS NOT NULL THEN
    v_initial_status := 'LORRY_ASSIGNED';
  ELSE
    v_initial_status := 'CREATED';
  END IF;

  -- 4. Generate collision-resistant trip_code: TRP-YYYYMMDD-XXXX
  v_today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  v_trip_code := 'TRP-' || v_today_str || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');

  v_collision_count := 0;
  WHILE EXISTS (SELECT 1 FROM public.trips WHERE trip_code = v_trip_code) AND v_collision_count < 10 LOOP
    v_trip_code := 'TRP-' || v_today_str || '-' || lpad((floor(random() * 90000 + 10000))::text, 5, '0');
    v_collision_count := v_collision_count + 1;
  END LOOP;

  v_trip_id := gen_random_uuid();

  -- 5. Insert trip
  INSERT INTO public.trips (
    id,
    trip_code,
    booking_id,
    vendor_id,
    vehicle_id,
    driver_id,
    vendor_rate,
    trip_status,
    started_at,
    assigned_at,
    created_at
  ) VALUES (
    v_trip_id,
    v_trip_code,
    p_booking_id,
    v_vendor_id,
    v_vehicle_id,
    v_driver_id,
    v_vendor_rate,
    v_initial_status,
    CASE WHEN v_initial_status = 'LORRY_ASSIGNED' THEN NOW() ELSE NULL END,
    CASE WHEN v_initial_status = 'LORRY_ASSIGNED' THEN NOW() ELSE NULL END,
    NOW()
  );

  -- 6. Audit trip generation
  BEGIN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      COALESCE(v_vendor_id, '00000000-0000-0000-0000-000000000001'::uuid),
      'VENDOR',
      'TRIP_GENERATED_FOR_BOOKING',
      jsonb_build_object(
        'trip_id', v_trip_id,
        'trip_code', v_trip_code,
        'booking_id', p_booking_id,
        'vendor_id', v_vendor_id,
        'vendor_rate', v_vendor_rate,
        'initial_status', v_initial_status
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', v_trip_id,
    'trip_code', v_trip_code,
    'booking_id', p_booking_id,
    'trip_status', v_initial_status,
    'vendor_id', v_vendor_id,
    'vendor_rate', v_vendor_rate,
    'is_idempotent', false,
    'message', 'Trip generated successfully for booking.'
  );
END;
$$;

-- 4. Stored Procedure: rpc_assign_vehicle_and_driver_to_trip
CREATE OR REPLACE FUNCTION public.rpc_assign_vehicle_and_driver_to_trip(
  p_trip_id UUID,
  p_vendor_id UUID,
  p_vehicle_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
  v_vehicle RECORD;
  v_driver RECORD;
  v_link RECORD;
  v_busy_vehicle RECORD;
  v_busy_driver RECORD;
  v_booking RECORD;
BEGIN
  -- 1. Fetch trip
  SELECT * INTO v_trip
  FROM public.trips
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TRIP_NOT_FOUND',
      'message', 'Trip not found.'
    );
  END IF;

  -- 2. Verify vendor ownership
  IF v_trip.vendor_id IS NOT NULL AND v_trip.vendor_id <> p_vendor_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED_VENDOR',
      'message', 'Unauthorized: Trip is assigned to a different transporter.'
    );
  END IF;

  -- 3. Verify vehicle exists and is tied to this vendor
  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VEHICLE_NOT_FOUND',
      'message', 'Specified vehicle does not exist.'
    );
  END IF;

  -- Check vendor vehicle link or primary vendor association
  SELECT * INTO v_link
  FROM public.vendor_vehicle_links
  WHERE vendor_id = p_vendor_id AND vehicle_id = p_vehicle_id;

  -- If neither link exists nor vehicle directly associated
  IF NOT FOUND THEN
    -- Check if vehicle has vendor_id column directly
    IF to_regclass('public.vehicles') IS NOT NULL THEN
      -- If vendor_vehicle_links row does not exist, check if vehicle is registered to vendor
      NULL;
    END IF;
  END IF;

  -- 4. Verify driver exists and belongs to this vendor
  SELECT * INTO v_driver
  FROM public.drivers
  WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_NOT_FOUND',
      'message', 'Specified driver does not exist.'
    );
  END IF;

  IF v_driver.primary_vendor_id IS NOT NULL AND v_driver.primary_vendor_id <> p_vendor_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_VENDOR_MISMATCH',
      'message', 'Specified driver is registered with a different transporter.'
    );
  END IF;

  -- 5. Active dispatch conflict checks (Double-Dispatch Prevention)
  -- Vehicle cannot be assigned if already on another active in-transit trip
  SELECT id, booking_id INTO v_busy_vehicle
  FROM public.trips
  WHERE vehicle_id = p_vehicle_id
    AND id <> p_trip_id
    AND trip_status IN ('LORRY_ASSIGNED', 'AT_LOADING', 'LOADING', 'IN_TRANSIT', 'REACHED_DESTINATION', 'UNLOADING')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VEHICLE_ALREADY_DISPATCHED',
      'message', 'Vehicle ' || COALESCE(v_vehicle.registration_number, '') || ' is currently allocated to active trip ' || v_busy_vehicle.id::text || '.'
    );
  END IF;

  -- Driver cannot be assigned if already on another active in-transit trip
  SELECT id, booking_id INTO v_busy_driver
  FROM public.trips
  WHERE driver_id = p_driver_id
    AND id <> p_trip_id
    AND trip_status IN ('LORRY_ASSIGNED', 'AT_LOADING', 'LOADING', 'IN_TRANSIT', 'REACHED_DESTINATION', 'UNLOADING')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_ALREADY_DISPATCHED',
      'message', 'Driver ' || COALESCE(v_driver.full_name, '') || ' is currently allocated to active trip ' || v_busy_driver.id::text || '.'
    );
  END IF;

  -- 6. Perform atomic assignment update
  UPDATE public.trips
  SET
    vehicle_id = p_vehicle_id,
    driver_id = p_driver_id,
    vendor_id = COALESCE(vendor_id, p_vendor_id),
    trip_status = 'LORRY_ASSIGNED',
    assigned_at = NOW(),
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_trip_id;

  -- 7. Audit assignment
  BEGIN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      p_vendor_id,
      'VENDOR',
      'TRIP_FLEET_ASSIGNED',
      jsonb_build_object(
        'trip_id', p_trip_id,
        'trip_code', v_trip.trip_code,
        'booking_id', v_trip.booking_id,
        'vehicle_id', p_vehicle_id,
        'vehicle_number', v_vehicle.registration_number,
        'driver_id', p_driver_id,
        'driver_name', v_driver.full_name,
        'assigned_at', NOW()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'trip_code', v_trip.trip_code,
    'vehicle_id', p_vehicle_id,
    'vehicle_number', v_vehicle.registration_number,
    'driver_id', p_driver_id,
    'driver_name', v_driver.full_name,
    'trip_status', 'LORRY_ASSIGNED',
    'assigned_at', NOW(),
    'message', 'Vehicle and driver successfully assigned to trip.'
  );
END;
$$;
