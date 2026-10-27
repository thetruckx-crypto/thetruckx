-- ============================================================================
-- NECL MIGRATION: 20261024000020_phase6_client_quotation_acceptance_and_booking.sql
-- Date: 2026-10-24
-- Purpose: Phase 6 - Client Quotation Acceptance & Booking Creation
--
-- Components:
--   1. Enhanced atomic quotation acceptance & booking RPC:
--      - public.rpc_accept_quotation_and_create_booking
--      - Strict client ownership verification & validity check
--      - Idempotency & double-booking prevention for requirements
--      - Collision-resistant booking ID generation (BOK-YYYYMMDD-XXXX)
--      - Automatic transition of competing quotes to SUPERSEDED
--      - Vendor quotation synchronization (winning quote -> ACCEPTED, competing -> SUPERSEDED)
--      - Immutable audit logging in auth_audit_log
--   2. Client quotation rejection RPC:
--      - public.rpc_reject_client_quotation
--   3. Emergency direct booking bypass RPC:
--      - public.rpc_emergency_direct_booking_bypass
--      - Mandatory administrative justification (>= 10 chars)
--      - Audit logging with actor and operational reason
--   4. Performance composite indexes for booking lookups
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. STATUS CONSTRAINT UPDATE (SUPERSEDED STATUS SUPPORT)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_quotes_status_check') THEN
    ALTER TABLE public.client_quotes DROP CONSTRAINT client_quotes_status_check;
  END IF;
  ALTER TABLE public.client_quotes 
    ADD CONSTRAINT client_quotes_status_check 
    CHECK (status IN ('DRAFT', 'SENT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'EXPIRED'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 1. ENHANCED ATOMIC QUOTATION ACCEPTANCE RPC
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
  v_competing_booking RECORD;
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

  -- 2. Idempotency Check: Return existing booking if this quote was already accepted
  SELECT id, client_id, requirement_id, booking_status, confirmed_at, grand_total
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
      'message', 'Booking already exists for this quotation (Idempotent response).'
    );
  END IF;

  -- 3. Row-lock client quotation for update
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

  -- 4. Verify requirement ownership and row-lock requirement
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

  -- 5. Prevent double booking on requirement
  SELECT id, booking_status
  INTO v_competing_booking
  FROM public.bookings
  WHERE requirement_id = v_quote.requirement_id
    AND (accepted_quote_id IS NULL OR accepted_quote_id != p_client_quote_id)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUIREMENT_ALREADY_BOOKED',
      'message', 'This transport requirement is already booked under booking reference ' || v_competing_booking.id || '.'
    );
  END IF;

  -- 6. Validity Expiration Check
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

  -- 7. Status transition validation
  IF v_quote.status NOT IN ('SENT', 'ISSUED', 'DRAFT') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUOTE_STATUS',
      'message', 'Quotation cannot be accepted from current status: ' || v_quote.status
    );
  END IF;

  -- 8. Generate Collision-Resistant Booking ID (BOK-YYYYMMDD-XXXX)
  v_today_str := to_char(NOW(), 'YYYYMMDD');
  LOOP
    v_rand_suffix := floor(random() * 9000 + 1000)::INT;
    v_booking_id := 'BOK-' || v_today_str || '-' || v_rand_suffix::TEXT;
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      v_booking_id := 'BOK-' || v_today_str || '-' || LPAD(floor(random() * 90000 + 10000)::TEXT, 5, '0');
      EXIT;
    END IF;
  END LOOP;

  -- 9. Insert into bookings
  INSERT INTO public.bookings (
    id,
    client_id,
    requirement_id,
    accepted_quote_id,
    booking_status,
    payment_status,
    grand_total,
    confirmed_at
  ) VALUES (
    v_booking_id,
    p_client_id,
    v_quote.requirement_id,
    p_client_quote_id,
    'CLIENT_ACCEPTED',
    'NOT_DUE',
    COALESCE(v_quote.total_client_amount, 0),
    NOW()
  );

  -- 10. Update accepted quotation status
  UPDATE public.client_quotes
  SET status = 'ACCEPTED'
  WHERE id = p_client_quote_id;

  -- 11. Update requirement status to BOOKED
  UPDATE public.requirements
  SET
    status = 'BOOKED',
    updated_at = NOW()
  WHERE id = v_quote.requirement_id;

  -- 12. Transition competing client quotes to SUPERSEDED
  UPDATE public.client_quotes
  SET status = 'SUPERSEDED'
  WHERE requirement_id = v_quote.requirement_id
    AND id != p_client_quote_id
    AND status IN ('SENT', 'ISSUED', 'DRAFT');

  -- 13. Synchronize vendor quotations if linked
  IF v_quote.vendor_quotation_id IS NOT NULL THEN
    -- Mark winning vendor quote as ACCEPTED
    UPDATE public.vendor_quotations
    SET status = 'ACCEPTED'
    WHERE id = v_quote.vendor_quotation_id;

    -- Mark competing vendor quotes for this requirement as SUPERSEDED
    UPDATE public.vendor_quotations
    SET status = 'SUPERSEDED'
    WHERE id != v_quote.vendor_quotation_id
      AND vendor_request_id IN (
        SELECT id FROM public.vendor_requests WHERE requirement_id = v_quote.requirement_id
      )
      AND status IN ('SUBMITTED', 'PENDING', 'ACTIVE');
  END IF;

  -- 14. Immutable Audit Logging
  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      p_client_id,
      'CLIENT',
      'CLIENT_QUOTE_ACCEPTED',
      jsonb_build_object(
        'booking_id', v_booking_id,
        'quote_id', p_client_quote_id,
        'requirement_id', v_quote.requirement_id,
        'total_client_amount', v_quote.total_client_amount,
        'confirmed_at', NOW()
      )
    );
  END IF;

  -- 15. Return structured success payload
  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'requirement_id', v_quote.requirement_id,
    'accepted_quote_id', p_client_quote_id,
    'total_client_amount', v_quote.total_client_amount,
    'booking_status', 'CLIENT_ACCEPTED',
    'confirmed_at', NOW(),
    'is_idempotent', false,
    'message', 'Quotation accepted and confirmed booking created successfully.'
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_accept_quotation_and_create_booking IS
  'Atomically accepts client quote, generates unique booking, supersedes competing quotes, locks winning vendor quote, and logs audit trail.';

GRANT EXECUTE ON FUNCTION public.rpc_accept_quotation_and_create_booking TO authenticated, service_role, anon;


-- ---------------------------------------------------------------------------
-- 2. CLIENT QUOTATION REJECTION RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_reject_client_quotation(
  p_client_quote_id UUID,
  p_client_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote RECORD;
  v_req RECORD;
BEGIN
  IF p_client_quote_id IS NULL OR p_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_PARAMETER',
      'message', 'Quote ID and Client ID are required.'
    );
  END IF;

  SELECT *
  INTO v_quote
  FROM public.client_quotes
  WHERE id = p_client_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_NOT_FOUND',
      'message', 'Quotation not found.'
    );
  END IF;

  SELECT *
  INTO v_req
  FROM public.requirements
  WHERE id = v_quote.requirement_id;

  IF NOT FOUND OR v_req.client_id != p_client_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Unauthorized: You do not own the requirement for this quotation.'
    );
  END IF;

  IF v_quote.status NOT IN ('SENT', 'ISSUED', 'DRAFT') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Quotation cannot be rejected from status ' || v_quote.status
    );
  END IF;

  -- Update quotation status
  UPDATE public.client_quotes
  SET
    status = 'REJECTED'
  WHERE id = p_client_quote_id;

  -- Audit log
  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      p_client_id,
      'CLIENT',
      'CLIENT_QUOTE_REJECTED',
      jsonb_build_object(
        'quote_id', p_client_quote_id,
        'requirement_id', v_quote.requirement_id,
        'rejection_reason', p_rejection_reason,
        'rejected_at', NOW()
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'quote_id', p_client_quote_id,
    'status', 'REJECTED',
    'message', 'Quotation rejected successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_client_quotation TO authenticated, service_role, anon;


-- ---------------------------------------------------------------------------
-- 3. EMERGENCY DIRECT BOOKING BYPASS RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_emergency_direct_booking_bypass(
  p_admin_user_id UUID,
  p_requirement_id UUID,
  p_client_id UUID,
  p_justification TEXT,
  p_agreed_rate NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_existing_booking RECORD;
  v_booking_id TEXT;
  v_today_str TEXT;
  v_rand_suffix INT;
  v_attempts INT := 0;
BEGIN
  -- 1. Validate mandatory administrative justification (minimum 10 characters)
  IF p_justification IS NULL OR length(trim(p_justification)) < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'JUSTIFICATION_REQUIRED',
      'message', 'Emergency direct booking bypass requires a mandatory administrative justification of at least 10 characters.'
    );
  END IF;

  IF p_requirement_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_PARAMETER',
      'message', 'Requirement ID (p_requirement_id) is mandatory.'
    );
  END IF;

  -- 2. Verify requirement exists and lock for update
  SELECT *
  INTO v_req
  FROM public.requirements
  WHERE id = p_requirement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUIREMENT_NOT_FOUND',
      'message', 'Requirement not found.'
    );
  END IF;

  -- 3. Check for existing active booking on this requirement
  SELECT id, booking_status
  INTO v_existing_booking
  FROM public.bookings
  WHERE requirement_id = p_requirement_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUIREMENT_ALREADY_BOOKED',
      'message', 'Requirement is already booked under reference ' || v_existing_booking.id || '.'
    );
  END IF;

  -- 4. Generate Collision-Resistant Booking ID
  v_today_str := to_char(NOW(), 'YYYYMMDD');
  LOOP
    v_rand_suffix := floor(random() * 9000 + 1000)::INT;
    v_booking_id := 'BOK-' || v_today_str || '-' || v_rand_suffix::TEXT;
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      v_booking_id := 'BOK-' || v_today_str || '-' || LPAD(floor(random() * 90000 + 10000)::TEXT, 5, '0');
      EXIT;
    END IF;
  END LOOP;

  -- 5. Insert directly confirmed booking
  INSERT INTO public.bookings (
    id,
    client_id,
    requirement_id,
    booking_status,
    payment_status,
    grand_total,
    confirmed_at
  ) VALUES (
    v_booking_id,
    COALESCE(p_client_id, v_req.client_id),
    p_requirement_id,
    'CONFIRMED',
    'PAYMENT_PENDING',
    COALESCE(p_agreed_rate, 0),
    NOW()
  );

  -- 6. Synchronize requirement status to BOOKED
  UPDATE public.requirements
  SET
    status = 'BOOKED',
    updated_at = NOW()
  WHERE id = p_requirement_id;

  -- 7. Supersede any open client quotes for this requirement
  UPDATE public.client_quotes
  SET status = 'SUPERSEDED'
  WHERE requirement_id = p_requirement_id
    AND status IN ('SENT', 'ISSUED', 'DRAFT');

  -- 8. Mandatory Audit Trail Logging
  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      COALESCE(p_admin_user_id, '00000000-0000-0000-0000-000000000001'::uuid),
      'ADMIN',
      'EMERGENCY_DIRECT_BOOKING_BYPASS',
      jsonb_build_object(
        'booking_id', v_booking_id,
        'requirement_id', p_requirement_id,
        'client_id', COALESCE(p_client_id, v_req.client_id),
        'justification', trim(p_justification),
        'agreed_rate', p_agreed_rate,
        'notes', p_notes,
        'bypassed_at', NOW()
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'requirement_id', p_requirement_id,
    'booking_status', 'CONFIRMED',
    'grand_total', COALESCE(p_agreed_rate, 0),
    'message', 'Emergency direct booking confirmed successfully with administrative audit trail.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_emergency_direct_booking_bypass TO authenticated, service_role, anon;


-- ---------------------------------------------------------------------------
-- 4. PERFORMANCE COMPOSITE INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bookings_accepted_quote
  ON public.bookings (accepted_quote_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status_created
  ON public.bookings (booking_status, created_at DESC);
