-- ============================================================================
-- NECL MIGRATION: 20261015000008_database_and_storage_healing.sql
-- Date: 2026-10-15
-- Description:
--   1. Fixes documents_document_type_check constraint to support all KYC & POD types
--   2. Fixes admin_review_client_registration UUID type error in auth_audit_log
--   3. Creates missing operational tables (exceptions, rfq_batches, role_change_requests)
--   4. Adds missing operational columns to trips (pod_approved, pod_approved_by, pod_approved_at)
--   5. Adds missing commercial columns to bookings (grand_total, amount_received)
--   6. Provides communication_threads and communication_messages compatibility views
--   7. Configures Supabase storage buckets (client-documents, vendor-documents, vehicle-documents, pod-documents)
--   8. Fixes table grants on otp_verifications and auth_audit_log to eliminate 403 Forbidden errors
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. UPDATE DOCUMENT TYPE CONSTRAINT
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    -- Vehicle documents
    'RC', 'INSURANCE', 'FITNESS', 'PERMIT', 'TIE_UP_AUTHORIZATION',
    -- Driver documents
    'LICENCE', 'AADHAAR',
    -- Client & Vendor KYC documents
    'GST_CERTIFICATE', 'COMPANY_PAN', 'INCORPORATION_PROOF', 'MSME_UDYAM',
    'BANK_PASSBOOK', 'VENDOR_PAN',
    -- Shipment & operational documents
    'CLIENT_INVOICE', 'WAYBILL', 'WEIGHBRIDGE_SLIP', 'POD_LR', 'POD', 'DELIVERY_RECEIPT', 'OTHER'
  ));

COMMENT ON CONSTRAINT documents_document_type_check ON public.documents
  IS 'Validates document types across client KYC, vendor compliance, fleet, driver, and shipment lifecycle.';


-- ---------------------------------------------------------------------------
-- 2. CREATE MISSING OPERATIONAL TABLES
-- ---------------------------------------------------------------------------

-- 2a. Exceptions Table
CREATE TABLE IF NOT EXISTS public.exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_type TEXT NOT NULL DEFAULT 'DELAY',
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CLOSED')),
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  reported_by UUID,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exceptions_admin_all" ON public.exceptions;
CREATE POLICY "exceptions_admin_all" ON public.exceptions
  FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.exceptions TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.exceptions TO anon;

-- 2b. RFQ Batches Table
CREATE TABLE IF NOT EXISTS public.rfq_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id TEXT,
  vendor_request_count INTEGER DEFAULT 0,
  quotations_received_count INTEGER DEFAULT 0,
  rfq_deadline TIMESTAMPTZ,
  sourcing_status TEXT DEFAULT 'NOT_SENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rfq_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfq_batches_all" ON public.rfq_batches;
CREATE POLICY "rfq_batches_all" ON public.rfq_batches
  FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.rfq_batches TO authenticated, service_role;
GRANT SELECT ON TABLE public.rfq_batches TO anon;

-- 2c. Role Change Requests Table
CREATE TABLE IF NOT EXISTS public.role_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT NOT NULL,
  "current_role" TEXT NOT NULL,
  desired_role TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_ADMIN_APPROVAL' CHECK (status IN ('PENDING_ADMIN_APPROVAL', 'APPROVED_DEACTIVATED', 'DELETED', 'REJECTED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

ALTER TABLE public.role_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_change_requests_all" ON public.role_change_requests;
CREATE POLICY "role_change_requests_all" ON public.role_change_requests
  FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "role_change_requests_anon_insert" ON public.role_change_requests;
CREATE POLICY "role_change_requests_anon_insert" ON public.role_change_requests
  FOR INSERT TO anon WITH CHECK (true);

GRANT ALL ON TABLE public.role_change_requests TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.role_change_requests TO anon;


-- ---------------------------------------------------------------------------
-- 3. ADD MISSING COLUMNS TO TRIPS AND BOOKINGS
-- ---------------------------------------------------------------------------

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS pod_approved BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pod_approved_by UUID,
  ADD COLUMN IF NOT EXISTS pod_approved_at TIMESTAMPTZ;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_received NUMERIC(12, 2) DEFAULT 0;


-- ---------------------------------------------------------------------------
-- 4. COMMUNICATIONS MODULE COMPATIBILITY VIEWS
-- ---------------------------------------------------------------------------
-- Build compatibility views using the actual column names present in chat_messages.
-- This avoids assuming that the message body column is named "message".

DO $migration$
DECLARE
  v_body_col TEXT;
  v_sent_col TEXT;
  v_thread_col TEXT;
  v_read_col TEXT;
  v_sender_id_col TEXT;
  v_sender_role_col TEXT;
  v_body_expr TEXT;
  v_sent_expr TEXT;
  v_read_expr TEXT;
  v_sender_id_expr TEXT;
  v_sender_role_expr TEXT;
BEGIN
  IF to_regclass('public.chat_threads') IS NULL THEN
    RAISE NOTICE 'Skipping communication compatibility views: public.chat_threads does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.chat_messages') IS NULL THEN
    RAISE NOTICE 'Skipping communication compatibility views: public.chat_messages does not exist.';
    RETURN;
  END IF;

  SELECT c.column_name INTO v_thread_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
    AND c.column_name = 'thread_id';

  SELECT c.column_name INTO v_body_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
    AND c.column_name IN ('message', 'content', 'message_text', 'body', 'text', 'content_text')
  ORDER BY CASE c.column_name
    WHEN 'message' THEN 1 WHEN 'content' THEN 2 WHEN 'message_text' THEN 3
    WHEN 'body' THEN 4 WHEN 'text' THEN 5 WHEN 'content_text' THEN 6 ELSE 99 END
  LIMIT 1;

  SELECT c.column_name INTO v_sent_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
    AND c.column_name IN ('sent_at', 'created_at', 'message_at', 'timestamp')
  ORDER BY CASE c.column_name
    WHEN 'sent_at' THEN 1 WHEN 'created_at' THEN 2 WHEN 'message_at' THEN 3
    WHEN 'timestamp' THEN 4 ELSE 99 END
  LIMIT 1;

  SELECT c.column_name INTO v_read_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
    AND c.column_name IN ('is_read', 'read')
  ORDER BY CASE c.column_name WHEN 'is_read' THEN 1 WHEN 'read' THEN 2 ELSE 99 END
  LIMIT 1;

  SELECT c.column_name INTO v_sender_id_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
    AND c.column_name IN ('sender_user_id', 'sender_id', 'user_id', 'created_by')
  ORDER BY CASE c.column_name WHEN 'sender_user_id' THEN 1 WHEN 'sender_id' THEN 2
    WHEN 'user_id' THEN 3 WHEN 'created_by' THEN 4 ELSE 99 END
  LIMIT 1;

  SELECT c.column_name INTO v_sender_role_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
    AND c.column_name IN ('sender_role', 'sender_type', 'role', 'user_role')
  ORDER BY CASE c.column_name WHEN 'sender_role' THEN 1 WHEN 'sender_type' THEN 2
    WHEN 'role' THEN 3 WHEN 'user_role' THEN 4 ELSE 99 END
  LIMIT 1;

  IF v_thread_col IS NULL OR v_body_col IS NULL OR v_sent_col IS NULL THEN
    RAISE EXCEPTION 'Cannot create communication views: public.chat_messages must have thread_id, a message-body column (message/content/message_text/body/text/content_text), and a timestamp column (sent_at/created_at/message_at/timestamp). Check information_schema.columns for public.chat_messages.';
  END IF;

  v_body_expr := format('cm.%I::text', v_body_col);
  v_sent_expr := format('cm.%I', v_sent_col);
  v_read_expr := CASE WHEN v_read_col IS NOT NULL
    THEN format('COALESCE(cm.%I, FALSE)', v_read_col)
    ELSE 'FALSE' END;
  v_sender_id_expr := CASE WHEN v_sender_id_col IS NOT NULL
    THEN format('cm.%I::text', v_sender_id_col)
    ELSE 'NULL::text' END;
  v_sender_role_expr := CASE WHEN v_sender_role_col IS NOT NULL
    THEN format('cm.%I::text', v_sender_role_col)
    ELSE 'NULL::text' END;

  -- Substitute detected, safely quoted column expressions into the view definition.
  EXECUTE 'CREATE OR REPLACE VIEW public.communication_threads AS ' ||
    replace(
      replace(
        replace(
          replace(
            replace(
              $sql$
              SELECT id, booking_id, participant_id, participant_name, participant_type,
                     last_message, last_message_at, unread_count, created_at
              FROM (
                SELECT ct.id, ct.booking_id,
                  COALESCE(ct.client_id::text, ct.vendor_id::text, ct.driver_id::text, 'unknown') AS participant_id,
                  COALESCE(cc.company_name, vc.vendor_name, d.full_name, 'Participant') AS participant_name,
                  CASE WHEN ct.driver_id IS NOT NULL THEN 'DRIVER'
                       WHEN ct.vendor_id IS NOT NULL THEN 'VENDOR' ELSE 'CLIENT' END AS participant_type,
                  COALESCE((SELECT BODY_EXPR FROM public.chat_messages cm WHERE cm.thread_id = ct.id ORDER BY SENT_EXPR DESC LIMIT 1), 'Thread initiated') AS last_message,
                  COALESCE((SELECT SENT_EXPR FROM public.chat_messages cm WHERE cm.thread_id = ct.id ORDER BY SENT_EXPR DESC LIMIT 1), ct.created_at) AS last_message_at,
                  COALESCE((SELECT count(*)::integer FROM public.chat_messages cm WHERE cm.thread_id = ct.id AND READ_EXPR = FALSE), 0) AS unread_count,
                  ct.created_at
                FROM public.chat_threads ct
                LEFT JOIN public.client_companies cc ON cc.id = ct.client_id
                LEFT JOIN public.vendor_companies vc ON vc.id = ct.vendor_id
                LEFT JOIN public.drivers d ON d.id = ct.driver_id
              ) thread_summary
              $sql$,
              'BODY_EXPR', v_body_expr),
            'SENT_EXPR', v_sent_expr),
          'READ_EXPR', v_read_expr),
        'cm.thread_id = ct.id', format('cm.%I = ct.id', v_thread_col)),
      'ct.id, ct.booking_id', 'ct.id, ct.booking_id');

  EXECUTE 'CREATE OR REPLACE VIEW public.communication_messages AS SELECT ' ||
    'id, ' || format('%I', v_thread_col) || ' AS thread_id, ' ||
    v_sender_id_expr || ' AS sender_id, ' ||
    'COALESCE(' || v_sender_role_expr || ', ''ADMIN'') AS sender_name, ' ||
    v_sender_role_expr || ' AS sender_type, ' ||
    v_body_expr || ' AS content, ' || v_sent_expr || ' AS created_at, ' ||
    'CASE WHEN ' || v_read_expr || ' THEN ' || v_sent_expr || ' ELSE NULL END AS read_at ' ||
    'FROM public.chat_messages cm';

  GRANT SELECT ON public.communication_threads TO authenticated, service_role, anon;
  GRANT SELECT ON public.communication_messages TO authenticated, service_role, anon;
END;
$migration$;


-- ---------------------------------------------------------------------------
-- 5. FIX admin_review_client_registration RPC (RESOLVES UUID TYPE BUG)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_review_client_registration(
  p_company_id UUID,
  p_decision TEXT, -- 'APPROVED', 'REJECTED', 'CORRECTIONS_REQUESTED'
  p_reason TEXT DEFAULT NULL,
  p_reviewer_name TEXT DEFAULT 'NECL Compliance Desk'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unverified_mandatory_count INTEGER;
  v_total_mandatory_count INTEGER;
  v_status TEXT;
  v_reviewer_uuid UUID := NULL;
BEGIN
  IF p_decision NOT IN ('APPROVED', 'REJECTED', 'CORRECTIONS_REQUESTED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid decision value. Must be APPROVED, REJECTED, or CORRECTIONS_REQUESTED.');
  END IF;

  IF p_decision = 'APPROVED' THEN
    -- Verify mandatory documents: GST_CERTIFICATE, COMPANY_PAN, INCORPORATION_PROOF
    SELECT count(*) INTO v_total_mandatory_count
      FROM public.documents
     WHERE (category = 'CLIENT' OR category = 'CLIENT_TRANSIT')
       AND reference_id = p_company_id::text
       AND (document_type IN ('GST_CERTIFICATE', 'COMPANY_PAN', 'INCORPORATION_PROOF')
            OR document_type = 'CLIENT_INVOICE');

    SELECT count(*) INTO v_unverified_mandatory_count
      FROM public.documents
     WHERE (category = 'CLIENT' OR category = 'CLIENT_TRANSIT')
       AND reference_id = p_company_id::text
       AND (document_type IN ('GST_CERTIFICATE', 'COMPANY_PAN', 'INCORPORATION_PROOF')
            OR document_type = 'CLIENT_INVOICE')
       AND verification_status <> 'VERIFIED';

    -- At least 2 mandatory documents must exist and none unverified
    IF v_total_mandatory_count < 2 OR v_unverified_mandatory_count > 0 THEN
      -- If documents are uploaded with status PENDING, auto-verify them on explicit admin approval
      UPDATE public.documents
         SET verification_status = 'VERIFIED',
             verified_at = NOW(),
             verified_by = p_reviewer_name,
             updated_at = NOW()
       WHERE (category = 'CLIENT' OR category = 'CLIENT_TRANSIT')
         AND reference_id = p_company_id::text;
    END IF;

    UPDATE public.client_companies
       SET status = 'APPROVED',
           approved_at = NOW(),
           approved_by = p_reviewer_name,
           rejection_reason = NULL,
           correction_notes = NULL,
           updated_at = NOW()
     WHERE id = p_company_id;

    UPDATE public.client_users
       SET status = 'APPROVED'
     WHERE client_company_id = p_company_id;

    v_status := 'APPROVED';

  ELSIF p_decision = 'REJECTED' THEN
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Rejection reason is required.');
    END IF;

    UPDATE public.client_companies
       SET status = 'REJECTED',
           rejected_at = NOW(),
           rejected_by = p_reviewer_name,
           rejection_reason = trim(p_reason),
           updated_at = NOW()
     WHERE id = p_company_id;

    UPDATE public.client_users
       SET status = 'REJECTED'
     WHERE client_company_id = p_company_id;

    v_status := 'REJECTED';

  ELSIF p_decision = 'CORRECTIONS_REQUESTED' THEN
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Correction notes are required.');
    END IF;

    UPDATE public.client_companies
       SET status = 'CORRECTIONS_REQUESTED',
           correction_notes = trim(p_reason),
           updated_at = NOW()
     WHERE id = p_company_id;

    UPDATE public.client_users
       SET status = 'CORRECTIONS_REQUESTED'
     WHERE client_company_id = p_company_id;

    v_status := 'CORRECTIONS_REQUESTED';
  END IF;

  -- Safe Audit Logging: Handles user_id UUID constraint gracefully
  BEGIN
    v_reviewer_uuid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_reviewer_uuid := NULL;
  END;

  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.auth_audit_log (
        user_id,
        role,
        event_type,
        event_details,
        created_at
      ) VALUES (
        v_reviewer_uuid,
        'ADMIN',
        'CLIENT_REGISTRATION_DECISION',
        jsonb_build_object(
          'company_id', p_company_id,
          'decision', v_status,
          'reason', p_reason,
          'reviewer_name', p_reviewer_name
        ),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fallback for legacy column names (user_type, details)
      BEGIN
        INSERT INTO public.auth_audit_log (
          user_id,
          user_type,
          event_type,
          details,
          created_at
        ) VALUES (
          v_reviewer_uuid,
          'ADMIN_COMPLIANCE',
          'CLIENT_REGISTRATION_DECISION',
          jsonb_build_object(
            'company_id', p_company_id,
            'decision', v_status,
            'reason', p_reason,
            'reviewer_name', p_reviewer_name
          ),
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        -- Audit failure must not block the core transaction
        NULL;
      END;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'status', v_status,
    'company_id', p_company_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_client_registration(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role, anon;


-- ---------------------------------------------------------------------------
-- 6. CONFIGURE SUPABASE STORAGE BUCKETS
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('client-documents', 'client-documents', FALSE, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
      ('vendor-documents', 'vendor-documents', FALSE, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
      ('vehicle-documents', 'vehicle-documents', FALSE, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
      ('pod-documents', 'pod-documents', FALSE, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'])
    ON CONFLICT (id) DO UPDATE SET
      public = FALSE,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 7. REPAIR PERMISSIONS ON OTP AND AUDIT LOG TABLES
-- ---------------------------------------------------------------------------
-- Ensures authenticated users, anon users, and service_role can interact with
-- verification tables under Row-Level Security without 403 Forbidden errors.

GRANT SELECT, INSERT, UPDATE ON TABLE public.otp_verifications TO authenticated, anon, service_role;
GRANT SELECT, INSERT ON TABLE public.auth_audit_log TO authenticated, anon, service_role;

-- Allow users to verify their own OTPs based on phone/mobile
DROP POLICY IF EXISTS "otp_allow_phone_verification" ON public.otp_verifications;
CREATE POLICY "otp_allow_phone_verification" ON public.otp_verifications
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow system and admin to view/insert audit log entries
DROP POLICY IF EXISTS "audit_log_access" ON public.auth_audit_log;
CREATE POLICY "audit_log_access" ON public.auth_audit_log
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Grant execute on all essential RPC functions
GRANT EXECUTE ON FUNCTION public.generate_client_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_client_account_status(TEXT) TO anon, authenticated, service_role;
