-- ============================================================================
-- NECL MIGRATION: 20261024000017_phase2_backend_stabilization_and_booking_rpc.sql
-- Date: 2026-10-24
-- Purpose: Phase 2 - Database, Backend & Business Logic Stabilization
--
-- Components:
--   1. Atomic booking stored procedure: rpc_accept_quotation_and_create_booking
--      - Row-level locking (FOR UPDATE)
--      - Strict client ownership verification
--      - Quote validity expiration guard (> NOW())
--      - Idempotent execution (returns existing booking if already booked)
--      - Atomic state transition (quote -> ACCEPTED, requirement -> BOOKED, booking -> CLIENT_ACCEPTED)
--      - Automatic rejection of competing open quotations
--   2. Weighbridge tolerance validation trigger on weighments (0.2 MT tolerance)
--   3. Trip status guard preventing transit with unresolved weighbridge discrepancies
--   4. Performance composite indexes for high-throughput operational queries
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ATOMIC QUOTATION ACCEPTANCE & BOOKING CREATION RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_accept_quotation_and_create_booking(
  p_client_quote_id UUID,
  p_client_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote RECORD;
  v_req RECORD;
  v_existing_booking RECORD;
  v_booking_id TEXT;
  v_today_str TEXT;
  v_rand_suffix INT;
  v_attempts INT := 0;
BEGIN
  -- 1. Input parameter validation
  IF p_client_quote_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_PARAMETER',
      'message', 'Quotation ID (p_client_quote_id) is mandatory.'
    );
  END IF;

  IF p_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_PARAMETER',
      'message', 'Client ID (p_client_id) is mandatory.'
    );
  END IF;

  -- 2. Idempotency Check: Check if booking already exists for this quote
  SELECT id, client_id, requirement_id, booking_status, confirmed_at
  INTO v_existing_booking
  FROM public.bookings
  WHERE accepted_quote_id = p_client_quote_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'booking_id', v_existing_booking.id,
      'requirement_id', v_existing_booking.requirement_id,
      'booking_status', v_existing_booking.booking_status,
      'confirmed_at', v_existing_booking.confirmed_at,
      'is_idempotent', true,
      'message', 'Booking already exists for this quotation.'
    );
  END IF;

  -- 3. Row-lock client quotation for update to prevent concurrent race conditions
  SELECT *
  INTO v_quote
  FROM public.client_quotes
  WHERE id = p_client_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_NOT_FOUND',
      'message', 'Quotation not found in system.'
    );
  END IF;

  -- 4. Verify requirement ownership and status
  SELECT *
  INTO v_req
  FROM public.requirements
  WHERE id = v_quote.requirement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUIREMENT_NOT_FOUND',
      'message', 'Associated transport requirement not found.'
    );
  END IF;

  IF v_req.client_id != p_client_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Unauthorized: Client does not own the associated transport requirement.'
    );
  END IF;

  -- 5. Validity Expiration Check
  IF v_quote.validity_expires_at IS NOT NULL AND v_quote.validity_expires_at < NOW() THEN
    UPDATE public.client_quotes
    SET status = 'EXPIRED'
    WHERE id = p_client_quote_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_EXPIRED',
      'message', 'Quotation validity expired on ' || to_char(v_quote.validity_expires_at, 'YYYY-MM-DD HH24:MI:SS') || ' UTC. Please request an updated quotation.'
    );
  END IF;

  -- 6. Status transition validation
  IF v_quote.status NOT IN ('SENT', 'ISSUED', 'DRAFT') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUOTE_STATUS',
      'message', 'Quotation cannot be accepted from current status: ' || v_quote.status
    );
  END IF;

  -- 7. Generate Collision-Resistant Booking ID (BOK-YYYYMMDD-###)
  v_today_str := to_char(NOW(), 'YYYYMMDD');
  LOOP
    v_rand_suffix := floor(random() * 900 + 100)::INT;
    v_booking_id := 'BOK-' || v_today_str || '-' || v_rand_suffix::TEXT;
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      v_booking_id := 'BOK-' || v_today_str || '-' || LPAD(floor(random() * 9000 + 1000)::TEXT, 4, '0');
      EXIT;
    END IF;
  END LOOP;

  -- 8. Atomic Insert into bookings
  INSERT INTO public.bookings (
    id,
    client_id,
    requirement_id,
    accepted_quote_id,
    booking_status,
    payment_status,
    confirmed_at
  ) VALUES (
    v_booking_id,
    p_client_id,
    v_quote.requirement_id,
    p_client_quote_id,
    'CLIENT_ACCEPTED',
    'NOT_DUE',
    NOW()
  );

  -- 9. Atomically mark accepted quotation
  UPDATE public.client_quotes
  SET
    status = 'ACCEPTED'
  WHERE id = p_client_quote_id;

  -- 10. Atomically update requirement status to BOOKED
  UPDATE public.requirements
  SET
    status = 'BOOKED',
    updated_at = NOW()
  WHERE id = v_quote.requirement_id;

  -- 11. Reject any remaining open or draft quotes for this requirement
  UPDATE public.client_quotes
  SET status = 'REJECTED'
  WHERE requirement_id = v_quote.requirement_id
    AND id != p_client_quote_id
    AND status IN ('SENT', 'ISSUED', 'DRAFT');

  -- 12. Return structured success payload
  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'requirement_id', v_quote.requirement_id,
    'accepted_quote_id', p_client_quote_id,
    'total_client_amount', v_quote.total_client_amount,
    'booking_status', 'CLIENT_ACCEPTED',
    'confirmed_at', NOW(),
    'message', 'Quotation accepted and booking confirmed successfully.'
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_accept_quotation_and_create_booking IS
  'Atomically accepts a client quote and creates a confirmed booking with row-level locking, expiration checks, and idempotency.';

GRANT EXECUTE ON FUNCTION public.rpc_accept_quotation_and_create_booking TO authenticated, service_role, anon;


-- ---------------------------------------------------------------------------
-- 2. DUAL WEIGHBRIDGE DISCREPANCY & TOLERANCE TRIGGER (0.2 MT)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_weighment_tolerance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_other_net NUMERIC(8, 2);
  v_delta NUMERIC(8, 2);
BEGIN
  -- Ensure gross weight is not less than tare weight
  IF NEW.gross_weight_mt IS NOT NULL AND NEW.tare_weight_mt IS NOT NULL THEN
    IF NEW.gross_weight_mt < NEW.tare_weight_mt THEN
      RAISE EXCEPTION 'Gross weight (%) cannot be less than tare weight (%)', NEW.gross_weight_mt, NEW.tare_weight_mt;
    END IF;

    -- Automatically compute net weight if not provided
    IF NEW.net_weight_mt IS NULL OR NEW.net_weight_mt = 0 THEN
      NEW.net_weight_mt := ROUND((NEW.gross_weight_mt - NEW.tare_weight_mt)::NUMERIC, 2);
    END IF;
  END IF;

  -- Check for existing weighment in same trip and stage to compute variance
  IF NEW.stage = 'LOADING' AND NEW.net_weight_mt IS NOT NULL AND NEW.trip_id IS NOT NULL THEN
    SELECT net_weight_mt
    INTO v_other_net
    FROM public.weighments
    WHERE trip_id = NEW.trip_id
      AND stage = 'LOADING'
      AND (NEW.id IS NULL OR id != NEW.id)
    ORDER BY recorded_at DESC
    LIMIT 1;

    IF FOUND AND v_other_net IS NOT NULL THEN
      v_delta := ABS(ROUND((NEW.net_weight_mt - v_other_net)::NUMERIC, 2));

      -- If variance exceeds standard 0.2 MT threshold, flag as DISCREPANCY
      IF v_delta > 0.20 THEN
        NEW.status := 'DISCREPANCY';
      ELSE
        NEW.status := 'MATCHED';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_weighment_tolerance ON public.weighments;
CREATE TRIGGER trg_validate_weighment_tolerance
  BEFORE INSERT OR UPDATE ON public.weighments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_weighment_tolerance();


-- ---------------------------------------------------------------------------
-- 3. TRIP TRANSIT GUARD TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_guard_trip_transit_on_weighment_discrepancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_discrepancy BOOLEAN;
  v_has_override BOOLEAN;
BEGIN
  -- When transitioning to IN_TRANSIT or LOADED
  IF NEW.trip_status IN ('IN_TRANSIT', 'LOADED') AND (OLD.trip_status IS NULL OR OLD.trip_status NOT IN ('IN_TRANSIT', 'LOADED')) THEN
    -- Check if any loading weighment has an active discrepancy
    SELECT EXISTS (
      SELECT 1
      FROM public.weighments
      WHERE trip_id = NEW.id
        AND stage = 'LOADING'
        AND status = 'DISCREPANCY'
    ) INTO v_has_discrepancy;

    IF v_has_discrepancy THEN
      -- Check if an admin override / resolved exception exists
      SELECT EXISTS (
        SELECT 1
        FROM public.exceptions
        WHERE trip_id = NEW.id
          AND exception_type IN ('WEIGHT_DISCREPANCY', 'WEIGHBRIDGE_VARIANCE')
          AND status IN ('RESOLVED', 'CLOSED')
      ) INTO v_has_override;

      IF NOT v_has_override THEN
        RAISE EXCEPTION 'Trip % cannot transition to %: Weighbridge variance exceeds 0.2 MT tolerance without approved administrative override.', NEW.id, NEW.trip_status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_trip_transit ON public.trips;
CREATE TRIGGER trg_guard_trip_transit
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_trip_transit_on_weighment_discrepancy();


-- ---------------------------------------------------------------------------
-- 4. PERFORMANCE COMPOSITE INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_requirements_client_status
  ON public.requirements (client_id, status);

CREATE INDEX IF NOT EXISTS idx_vendor_requests_req_vendor
  ON public.vendor_requests (requirement_id, vendor_id);

CREATE INDEX IF NOT EXISTS idx_client_quotes_requirement
  ON public.client_quotes (requirement_id);

CREATE INDEX IF NOT EXISTS idx_client_quotes_status
  ON public.client_quotes (status);

CREATE INDEX IF NOT EXISTS idx_bookings_client_req
  ON public.bookings (client_id, requirement_id);

CREATE INDEX IF NOT EXISTS idx_weighments_trip_stage
  ON public.weighments (trip_id, stage);

CREATE INDEX IF NOT EXISTS idx_trips_booking_status
  ON public.trips (booking_id, trip_status);
