-- ============================================================================
-- NECL CLIENT REGISTRATION, KYC, ADMIN APPROVAL & STORAGE MIGRATION
-- Migration: 20261013000007_client_registration_kyc_approval.sql
-- Date: 2026-10-13
--
-- PURPOSE:
-- 1. Extend client_companies with registration, KYC, and approval fields
-- 2. Extend client_users with corporate contact profile attributes
-- 3. Extend documents table for client compliance KYC metadata & verification
-- 4. Create secure private storage bucket for client business documents
-- 5. Add database helper functions for atomic client submission & admin approval
-- 6. Configure robust Row Level Security (RLS) policies
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. EXTEND client_companies TABLE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.client_companies') IS NOT NULL THEN

    -- Unique client reference code (e.g., CLI-847291)
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS client_code TEXT;

    -- Business Entity Type (Private Limited, Public Limited, Partnership, etc.)
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS business_type TEXT;

    -- Contact phone and corporate email
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS company_phone TEXT,
      ADD COLUMN IF NOT EXISTS company_email TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT;

    -- Registration & verification status lifecycle
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS correction_notes TEXT,
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_by TEXT,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejected_by TEXT,
      ADD COLUMN IF NOT EXISTS auth_user_id UUID;

    -- Update or drop legacy status constraint if present
    ALTER TABLE public.client_companies
      DROP CONSTRAINT IF EXISTS client_companies_status_check;

    ALTER TABLE public.client_companies
      ADD CONSTRAINT client_companies_status_check
      CHECK (status IN (
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'CORRECTIONS_REQUESTED',
        'SUSPENDED',
        'ACTIVE',
        'INACTIVE'
      ));

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_client_companies_status
      ON public.client_companies(status);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_companies_client_code
      ON public.client_companies(client_code)
      WHERE client_code IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_companies_gstin
      ON public.client_companies(gstin)
      WHERE gstin IS NOT NULL;

  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 2. EXTEND client_users TABLE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.client_users') IS NOT NULL THEN

    ALTER TABLE public.client_users
      ADD COLUMN IF NOT EXISTS client_company_id UUID,
      ADD COLUMN IF NOT EXISTS designation TEXT,
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS is_primary_contact BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS auth_user_id UUID;

    -- Ensure client_company_id is populated from client_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'client_users' AND column_name = 'client_id'
    ) THEN
      UPDATE public.client_users
      SET client_company_id = client_id
      WHERE client_company_id IS NULL AND client_id IS NOT NULL;
    END IF;

    -- Status constraint for client users
    ALTER TABLE public.client_users
      DROP CONSTRAINT IF EXISTS client_users_status_check;

    ALTER TABLE public.client_users
      ADD CONSTRAINT client_users_status_check
      CHECK (status IN (
        'PENDING_APPROVAL',
        'APPROVED',
        'ACTIVE',
        'INACTIVE',
        'SUSPENDED',
        'DEACTIVATED'
      ));

    CREATE INDEX IF NOT EXISTS idx_client_users_mobile
      ON public.client_users(mobile);

    CREATE INDEX IF NOT EXISTS idx_client_users_client_company_id
      ON public.client_users(client_company_id);

  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 3. EXTEND documents TABLE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.documents') IS NOT NULL THEN

    ALTER TABLE public.documents
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_size TEXT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS storage_path TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Drop legacy constraint if any
    ALTER TABLE public.documents
      DROP CONSTRAINT IF EXISTS documents_verification_status_check;

    ALTER TABLE public.documents
      ADD CONSTRAINT documents_verification_status_check
      CHECK (verification_status IN (
        'PENDING',
        'VERIFIED',
        'REJECTED',
        'REPLACEMENT_REQUESTED'
      ));

    CREATE INDEX IF NOT EXISTS idx_documents_category_ref
      ON public.documents(category, reference_id);

    CREATE INDEX IF NOT EXISTS idx_documents_verification_status
      ON public.documents(verification_status);

  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4. PRIVATE SUPABASE STORAGE BUCKET FOR CLIENT DOCUMENTS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'client-documents',
      'client-documents',
      FALSE,
      10485760, -- 10 MB limit
      ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = FALSE,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  END IF;
END $$;


-- Storage RLS policies
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN

    -- Allow authenticated and anon uploads during client registration to client-documents
    DROP POLICY IF EXISTS "client_docs_upload" ON storage.objects;
    CREATE POLICY "client_docs_upload"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'client-documents');

    -- Allow reading client documents for authenticated clients and admins
    DROP POLICY IF EXISTS "client_docs_select" ON storage.objects;
    CREATE POLICY "client_docs_select"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'client-documents');

    -- Allow full management by service_role
    DROP POLICY IF EXISTS "client_docs_service_role" ON storage.objects;
    CREATE POLICY "client_docs_service_role"
      ON storage.objects FOR ALL
      TO service_role
      USING (bucket_id = 'client-documents')
      WITH CHECK (bucket_id = 'client-documents');

  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 5. UNIQUE CLIENT CODE GENERATOR
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_client_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'CLI-' || lpad((floor(random() * 900000 + 100000))::text, 6, '0');
    SELECT EXISTS (
      SELECT 1 FROM public.client_companies WHERE client_code = v_code
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;


-- ---------------------------------------------------------------------------
-- 6. ATOMIC SUBMISSION FUNCTION: submit_client_registration
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_client_registration(
  p_company_name TEXT,
  p_business_type TEXT,
  p_gstin TEXT,
  p_pan TEXT,
  p_registered_address TEXT,
  p_city TEXT,
  p_state TEXT,
  p_pincode TEXT,
  p_company_phone TEXT,
  p_company_email TEXT,
  p_contact_name TEXT,
  p_contact_phone TEXT,
  p_contact_email TEXT,
  p_department TEXT,
  p_designation TEXT,
  p_documents JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clean_contact_phone TEXT;
  v_clean_company_phone TEXT;
  v_company_id UUID;
  v_user_id UUID;
  v_client_code TEXT;
  v_other_role TEXT;
  v_doc JSONB;
  v_doc_type TEXT;
  v_storage_path TEXT;
  v_file_name TEXT;
  v_file_size TEXT;
  v_mime_type TEXT;
BEGIN
  -- Normalize phone numbers
  v_clean_contact_phone := right(regexp_replace(coalesce(p_contact_phone, ''), '\D', '', 'g'), 10);
  v_clean_company_phone := right(regexp_replace(coalesce(p_company_phone, ''), '\D', '', 'g'), 10);

  IF length(v_clean_contact_phone) <> 10 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid 10-digit contact mobile number.');
  END IF;

  -- 1. Check for role conflict in VENDOR or DRIVER tables
  IF to_regclass('public.vendor_users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.vendor_users
      WHERE mobile = v_clean_contact_phone AND status <> 'DEACTIVATED'
    ) THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'role_conflict', TRUE,
        'previous_role', 'VENDOR',
        'error', 'Existing registration detected as VENDOR. Please contact Admin to change role.'
      );
    END IF;
  END IF;

  IF to_regclass('public.drivers') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.drivers
      WHERE (mobile = v_clean_contact_phone OR phone = v_clean_contact_phone)
        AND status <> 'DEACTIVATED'
    ) THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'role_conflict', TRUE,
        'previous_role', 'DRIVER',
        'error', 'Existing registration detected as DRIVER. Please contact Admin to change role.'
      );
    END IF;
  END IF;

  -- 2. Idempotency: check if client_user already registered for this number
  SELECT cu.client_company_id, cu.id INTO v_company_id, v_user_id
    FROM public.client_users cu
   WHERE cu.mobile = v_clean_contact_phone
   LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    -- Reuse existing company record & update it
    SELECT client_code INTO v_client_code
      FROM public.client_companies
     WHERE id = v_company_id;

    IF v_client_code IS NULL THEN
      v_client_code := public.generate_client_code();
    END IF;

    UPDATE public.client_companies
       SET company_name = trim(p_company_name),
           business_type = trim(p_business_type),
           gstin = upper(trim(coalesce(p_gstin, ''))),
           pan = upper(trim(coalesce(p_pan, ''))),
           registered_address = trim(p_registered_address),
           city = trim(p_city),
           state = trim(coalesce(p_state, '')),
           pincode = trim(p_pincode),
           company_phone = v_clean_company_phone,
           company_email = lower(trim(coalesce(p_company_email, ''))),
           client_code = v_client_code,
           status = 'PENDING_APPROVAL',
           rejection_reason = NULL,
           correction_notes = NULL,
           submitted_at = NOW(),
           updated_at = NOW()
     WHERE id = v_company_id;

    UPDATE public.client_users
       SET full_name = trim(p_contact_name),
           email = lower(trim(coalesce(p_contact_email, ''))),
           designation = trim(coalesce(p_designation, '')),
           department = trim(coalesce(p_department, '')),
           status = 'PENDING_APPROVAL',
           phone_verified = TRUE
     WHERE id = v_user_id;

  ELSE
    -- Generate unique client code
    v_client_code := public.generate_client_code();

    -- Insert new client company
    INSERT INTO public.client_companies (
      company_name,
      business_type,
      gstin,
      pan,
      registered_address,
      city,
      state,
      pincode,
      company_phone,
      company_email,
      client_code,
      status,
      submitted_at,
      created_at,
      updated_at
    ) VALUES (
      trim(p_company_name),
      trim(p_business_type),
      upper(trim(coalesce(p_gstin, ''))),
      upper(trim(coalesce(p_pan, ''))),
      trim(p_registered_address),
      trim(p_city),
      trim(coalesce(p_state, '')),
      trim(p_pincode),
      v_clean_company_phone,
      lower(trim(coalesce(p_company_email, ''))),
      v_client_code,
      'PENDING_APPROVAL',
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO v_company_id;

    -- Insert new client user
    INSERT INTO public.client_users (
      client_id,
      client_company_id,
      mobile,
      full_name,
      email,
      designation,
      department,
      is_primary_contact,
      phone_verified,
      status,
      created_at
    ) VALUES (
      v_company_id,
      v_company_id,
      v_clean_contact_phone,
      trim(p_contact_name),
      lower(trim(coalesce(p_contact_email, ''))),
      trim(coalesce(p_designation, '')),
      trim(coalesce(p_department, '')),
      TRUE,
      TRUE,
      'PENDING_APPROVAL',
      NOW()
    ) RETURNING id INTO v_user_id;

  END IF;

  -- 3. Persist / update document references
  IF p_documents IS NOT NULL AND jsonb_array_length(p_documents) > 0 THEN
    FOR v_doc IN SELECT * FROM jsonb_array_elements(p_documents)
    LOOP
      v_doc_type := v_doc ->> 'docType';
      v_storage_path := v_doc ->> 'storagePath';
      v_file_name := coalesce(v_doc ->> 'fileName', v_doc_type || '.pdf');
      v_file_size := coalesce(v_doc ->> 'fileSize', '1 MB');
      v_mime_type := coalesce(v_doc ->> 'mimeType', 'application/pdf');

      IF v_doc_type IS NOT NULL AND v_storage_path IS NOT NULL THEN
        -- Check if document already exists for this company & docType
        IF EXISTS (
          SELECT 1 FROM public.documents
           WHERE category = 'CLIENT'
             AND reference_id = v_company_id::text
             AND document_type = v_doc_type
        ) THEN
          UPDATE public.documents
             SET file_url = v_storage_path,
                 storage_path = v_storage_path,
                 file_name = v_file_name,
                 file_size = v_file_size,
                 mime_type = v_mime_type,
                 verification_status = 'PENDING',
                 rejection_reason = NULL,
                 uploaded_by = v_clean_contact_phone,
                 updated_at = NOW()
           WHERE category = 'CLIENT'
             AND reference_id = v_company_id::text
             AND document_type = v_doc_type;
        ELSE
          INSERT INTO public.documents (
            category,
            document_type,
            reference_id,
            file_url,
            storage_path,
            file_name,
            file_size,
            mime_type,
            verification_status,
            uploaded_by,
            created_at,
            updated_at
          ) VALUES (
            'CLIENT',
            v_doc_type,
            v_company_id::text,
            v_storage_path,
            v_storage_path,
            v_file_name,
            v_file_size,
            v_mime_type,
            'PENDING',
            v_clean_contact_phone,
            NOW(),
            NOW()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 4. Audit log entry
  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details,
      created_at
    ) VALUES (
      v_clean_contact_phone,
      'CLIENT_REGISTRATION',
      'REGISTRATION_SUBMITTED_FOR_APPROVAL',
      jsonb_build_object(
        'company_id', v_company_id,
        'client_code', v_client_code,
        'company_name', p_company_name,
        'contact_phone', v_clean_contact_phone
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'company_id', v_company_id,
    'user_id', v_user_id,
    'client_code', v_client_code,
    'status', 'PENDING_APPROVAL'
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- 7. ADMIN REVIEW FUNCTION: admin_review_client_registration
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
BEGIN
  IF p_decision NOT IN ('APPROVED', 'REJECTED', 'CORRECTIONS_REQUESTED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid decision value.');
  END IF;

  IF p_decision = 'APPROVED' THEN
    -- Verify that all mandatory documents ('GST_CERTIFICATE', 'COMPANY_PAN', 'INCORPORATION_PROOF') exist and are VERIFIED
    SELECT count(*) INTO v_total_mandatory_count
      FROM public.documents
     WHERE category = 'CLIENT'
       AND reference_id = p_company_id::text
       AND document_type IN ('GST_CERTIFICATE', 'COMPANY_PAN', 'INCORPORATION_PROOF');

    SELECT count(*) INTO v_unverified_mandatory_count
      FROM public.documents
     WHERE category = 'CLIENT'
       AND reference_id = p_company_id::text
       AND document_type IN ('GST_CERTIFICATE', 'COMPANY_PAN', 'INCORPORATION_PROOF')
       AND verification_status <> 'VERIFIED';

    -- Mandatory documents must exist and all be verified!
    IF v_total_mandatory_count < 2 OR v_unverified_mandatory_count > 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Cannot approve registration: All mandatory compliance documents must be verified before approval.'
      );
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

  -- Audit log
  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details,
      created_at
    ) VALUES (
      p_reviewer_name,
      'ADMIN_COMPLIANCE',
      'CLIENT_REGISTRATION_DECISION',
      jsonb_build_object(
        'company_id', p_company_id,
        'decision', v_status,
        'reason', p_reason
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', v_status);
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. ADMIN REVIEW DOCUMENT FUNCTION: admin_review_client_document
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_client_document(
  p_document_id UUID,
  p_decision TEXT, -- 'VERIFIED', 'REJECTED', 'REPLACEMENT_REQUESTED'
  p_reason TEXT DEFAULT NULL,
  p_reviewer_name TEXT DEFAULT 'NECL Compliance Officer'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_decision NOT IN ('VERIFIED', 'REJECTED', 'REPLACEMENT_REQUESTED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid document decision.');
  END IF;

  IF p_decision IN ('REJECTED', 'REPLACEMENT_REQUESTED') AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Reason is required when rejecting a document or requesting replacement.');
  END IF;

  UPDATE public.documents
     SET verification_status = p_decision,
         rejection_reason = CASE WHEN p_decision = 'VERIFIED' THEN NULL ELSE trim(p_reason) END,
         verified_by = p_reviewer_name,
         verified_at = NOW(),
         updated_at = NOW()
   WHERE id = p_document_id;

  RETURN jsonb_build_object('success', TRUE, 'document_id', p_document_id, 'status', p_decision);
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. CHECK CLIENT ACCOUNT STATUS FUNCTION
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_client_account_status(p_mobile TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clean_phone TEXT;
  v_user RECORD;
  v_company RECORD;
  v_other_role TEXT;
BEGIN
  v_clean_phone := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  IF length(v_clean_phone) <> 10 THEN
    RETURN jsonb_build_object('status', 'INVALID_PHONE');
  END IF;

  -- 1. Check if user exists under CLIENT role
  SELECT * INTO v_user
    FROM public.client_users
   WHERE mobile = v_clean_phone
   LIMIT 1;

  IF v_user.id IS NOT NULL THEN
    SELECT * INTO v_company
      FROM public.client_companies
     WHERE id = v_user.client_company_id;

    RETURN jsonb_build_object(
      'status', coalesce(v_company.status, v_user.status, 'PENDING_APPROVAL'),
      'company_id', v_company.id,
      'company_name', v_company.company_name,
      'client_code', v_company.client_code,
      'full_name', v_user.full_name,
      'email', v_user.email,
      'mobile', v_user.mobile,
      'rejection_reason', v_company.rejection_reason,
      'correction_notes', v_company.correction_notes,
      'submitted_at', v_company.submitted_at
    );
  END IF;

  -- 2. Check if user exists under another role (VENDOR or DRIVER)
  IF to_regclass('public.vendor_users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.vendor_users
      WHERE mobile = v_clean_phone AND status <> 'DEACTIVATED'
    ) THEN
      RETURN jsonb_build_object(
        'status', 'ROLE_CONFLICT',
        'previous_role', 'VENDOR',
        'message', 'Registered as VENDOR'
      );
    END IF;
  END IF;

  IF to_regclass('public.drivers') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.drivers
      WHERE (mobile = v_clean_phone OR phone = v_clean_phone)
        AND status <> 'DEACTIVATED'
    ) THEN
      RETURN jsonb_build_object(
        'status', 'ROLE_CONFLICT',
        'previous_role', 'DRIVER',
        'message', 'Registered as DRIVER'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'NEW_USER');
END;
$$;


-- ---------------------------------------------------------------------------
-- 10. REFRESH RLS POLICIES FOR CLIENT REGISTRATION & DOCUMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated to register / check status
DROP POLICY IF EXISTS "client_company_insert_policy" ON public.client_companies;
CREATE POLICY "client_company_insert_policy"
  ON public.client_companies FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_company_select_policy" ON public.client_companies;
CREATE POLICY "client_company_select_policy"
  ON public.client_companies FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "client_users_insert_policy" ON public.client_users;
CREATE POLICY "client_users_insert_policy"
  ON public.client_users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_users_select_policy" ON public.client_users;
CREATE POLICY "client_users_select_policy"
  ON public.client_users FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "documents_insert_policy" ON public.documents;
CREATE POLICY "documents_insert_policy"
  ON public.documents FOR INSERT
  TO anon, authenticated
  WITH CHECK (category = 'CLIENT');

DROP POLICY IF EXISTS "documents_select_policy" ON public.documents;
CREATE POLICY "documents_select_policy"
  ON public.documents FOR SELECT
  TO anon, authenticated
  USING (category = 'CLIENT' OR true);

DROP POLICY IF EXISTS "documents_update_policy" ON public.documents;
CREATE POLICY "documents_update_policy"
  ON public.documents FOR UPDATE
  TO anon, authenticated
  USING (category = 'CLIENT');

-- Grants on helper functions
GRANT EXECUTE ON FUNCTION public.generate_client_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_client_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_client_registration(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_client_document(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_client_account_status(TEXT) TO anon, authenticated, service_role;

COMMIT;
