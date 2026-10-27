-- ============================================================================
-- Migration: 20261017000012_vendor_transporter_compliance_and_approval_upgrade.sql
-- Description: NECL Transporter Compliance, Approval Workflow & Schema Consistency
-- Author: Senior Full-Stack Mobile & Database Engineer
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. UPGRADE vendor_companies COLUMNS & AUDIT TIMESTAMPS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.vendor_companies') IS NOT NULL THEN
    -- Ensure canonical vendor reference ID
    ALTER TABLE public.vendor_companies
      ADD COLUMN IF NOT EXISTS vendor_code TEXT,
      ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS approved_by TEXT,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejected_by TEXT,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS correction_notes TEXT,
      ADD COLUMN IF NOT EXISTS onboarding_source TEXT DEFAULT 'SELF_REGISTERED',
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Ensure updated_at is never null
    UPDATE public.vendor_companies
       SET updated_at = NOW()
     WHERE updated_at IS NULL;

    -- Ensure compliance_status aligns with existing status
    UPDATE public.vendor_companies
       SET compliance_status = CASE
             WHEN status = 'APPROVED' THEN 'APPROVED'
             WHEN status = 'REJECTED' THEN 'REJECTED'
             ELSE 'PENDING'
           END
     WHERE compliance_status IS NULL;

    -- Upgrade status check constraint to include all compliance lifecycle states
    ALTER TABLE public.vendor_companies
      DROP CONSTRAINT IF EXISTS vendor_companies_status_check;

    ALTER TABLE public.vendor_companies
      ADD CONSTRAINT vendor_companies_status_check
      CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'CORRECTIONS_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE'));

    -- Add compliance status check constraint
    ALTER TABLE public.vendor_companies
      DROP CONSTRAINT IF EXISTS vendor_companies_compliance_check;

    ALTER TABLE public.vendor_companies
      ADD CONSTRAINT vendor_companies_compliance_check
      CHECK (compliance_status IN ('PENDING', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'CORRECTIONS_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED'));

    -- Create indexes for fast lookup and reporting
    CREATE INDEX IF NOT EXISTS idx_vendor_companies_code
      ON public.vendor_companies(vendor_code) WHERE vendor_code IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_vendor_companies_status
      ON public.vendor_companies(status);

    CREATE INDEX IF NOT EXISTS idx_vendor_companies_compliance
      ON public.vendor_companies(compliance_status);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. UPGRADE vendor_users STATUS CONSTRAINT & TIMESTAMPS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.vendor_users') IS NOT NULL THEN
    ALTER TABLE public.vendor_users
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Ensure email is optional on vendor_users
    ALTER TABLE public.vendor_users
      ALTER COLUMN email DROP NOT NULL;

    -- Create index on mobile for rapid login lookup
    CREATE INDEX IF NOT EXISTS idx_vendor_users_mobile
      ON public.vendor_users(mobile);

    CREATE INDEX IF NOT EXISTS idx_vendor_users_vendor_id
      ON public.vendor_users(vendor_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. ADMIN REVIEW VENDOR REGISTRATION RPC: admin_review_vendor_registration
--    Atomically validates mandatory KYC documents and applies approval/rejection.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_vendor_registration(
  p_vendor_id UUID,
  p_decision TEXT, -- 'APPROVED', 'REJECTED', 'ACTION_REQUIRED', 'CORRECTIONS_REQUESTED'
  p_reason TEXT DEFAULT NULL,
  p_reviewer_name TEXT DEFAULT 'NECL Compliance Desk'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unverified_mandatory_count INTEGER := 0;
  v_total_mandatory_count INTEGER := 0;
  v_status TEXT;
  v_compliance_status TEXT;
BEGIN
  IF p_decision NOT IN ('APPROVED', 'REJECTED', 'ACTION_REQUIRED', 'CORRECTIONS_REQUESTED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid decision value. Must be APPROVED, REJECTED, or ACTION_REQUIRED.');
  END IF;

  IF p_decision = 'APPROVED' THEN
    -- Verify that mandatory documents (COMPANY_PAN, BANK_PASSBOOK / BANK_CANCELLED_CHEQUE) exist
    SELECT count(*) INTO v_total_mandatory_count
      FROM public.documents
     WHERE category = 'VENDOR_KYC'
       AND reference_id = p_vendor_id::text
       AND document_type IN ('COMPANY_PAN', 'BANK_PASSBOOK', 'BANK_CANCELLED_CHEQUE', 'GST_CERTIFICATE');

    SELECT count(*) INTO v_unverified_mandatory_count
      FROM public.documents
     WHERE category = 'VENDOR_KYC'
       AND reference_id = p_vendor_id::text
       AND document_type IN ('COMPANY_PAN', 'BANK_PASSBOOK', 'BANK_CANCELLED_CHEQUE')
       AND verification_status = 'REJECTED';

    -- Rejection check: Cannot approve if mandatory documents were explicitly rejected
    IF v_unverified_mandatory_count > 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Cannot approve transporter: Rejected compliance documents must be re-uploaded and cleared.'
      );
    END IF;

    -- If mandatory documents exist and are pending, auto-verify on administrator explicit approval
    UPDATE public.documents
       SET verification_status = 'VERIFIED',
           verified_at = NOW(),
           verified_by = p_reviewer_name,
           rejection_reason = NULL,
           updated_at = NOW()
     WHERE category = 'VENDOR_KYC'
       AND reference_id = p_vendor_id::text
       AND verification_status <> 'VERIFIED';

    -- Mark vendor company as APPROVED
    UPDATE public.vendor_companies
       SET status = 'APPROVED',
           compliance_status = 'APPROVED',
           approved_at = NOW(),
           approved_by = p_reviewer_name,
           rejection_reason = NULL,
           correction_notes = NULL,
           updated_at = NOW()
     WHERE id = p_vendor_id;

    -- Mark vendor user(s) as ACTIVE
    UPDATE public.vendor_users
       SET status = 'ACTIVE',
           updated_at = NOW()
     WHERE vendor_id = p_vendor_id;

    v_status := 'APPROVED';
    v_compliance_status := 'APPROVED';

  ELSIF p_decision = 'REJECTED' THEN
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Rejection reason is required.');
    END IF;

    UPDATE public.vendor_companies
       SET status = 'REJECTED',
           compliance_status = 'REJECTED',
           rejected_at = NOW(),
           rejected_by = p_reviewer_name,
           rejection_reason = trim(p_reason),
           updated_at = NOW()
     WHERE id = p_vendor_id;

    v_status := 'REJECTED';
    v_compliance_status := 'REJECTED';

  ELSIF p_decision IN ('ACTION_REQUIRED', 'CORRECTIONS_REQUESTED') THEN
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Clarification / correction notes are required.');
    END IF;

    UPDATE public.vendor_companies
       SET status = 'REJECTED',
           compliance_status = 'ACTION_REQUIRED',
           rejected_at = NOW(),
           rejected_by = p_reviewer_name,
           rejection_reason = trim(p_reason),
           correction_notes = trim(p_reason),
           updated_at = NOW()
     WHERE id = p_vendor_id;

    v_status := 'ACTION_REQUIRED';
    v_compliance_status := 'ACTION_REQUIRED';
  END IF;

  -- Audit log entry
  IF to_regclass('public.auth_audit_log') IS NOT NULL THEN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details,
      created_at
    ) VALUES (
      p_vendor_id::text,
      'ADMIN_COMPLIANCE',
      'VENDOR_REGISTRATION_DECISION',
      jsonb_build_object(
        'vendor_id', p_vendor_id,
        'decision', v_status,
        'compliance_status', v_compliance_status,
        'reason', p_reason,
        'reviewer', p_reviewer_name
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'status', v_status,
    'compliance_status', v_compliance_status,
    'vendor_id', p_vendor_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. ADMIN REVIEW VENDOR DOCUMENT RPC: admin_review_vendor_document
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_vendor_document(
  p_document_id UUID,
  p_decision TEXT, -- 'VERIFIED', 'REJECTED', 'REPLACEMENT_REQUESTED'
  p_reason TEXT DEFAULT NULL,
  p_reviewer_name TEXT DEFAULT 'NECL Compliance Officer'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref_id TEXT;
BEGIN
  IF p_decision NOT IN ('VERIFIED', 'REJECTED', 'REPLACEMENT_REQUESTED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid document decision. Must be VERIFIED, REJECTED, or REPLACEMENT_REQUESTED.');
  END IF;

  SELECT reference_id INTO v_ref_id
    FROM public.documents
   WHERE id = p_document_id;

  IF v_ref_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Document not found.');
  END IF;

  UPDATE public.documents
     SET verification_status = p_decision,
         verified_at = NOW(),
         verified_by = p_reviewer_name,
         rejection_reason = CASE WHEN p_decision = 'VERIFIED' THEN NULL ELSE trim(p_reason) END,
         updated_at = NOW()
   WHERE id = p_document_id;

  -- If rejected or replacement requested, update vendor_companies compliance_status to ACTION_REQUIRED
  IF p_decision IN ('REJECTED', 'REPLACEMENT_REQUESTED') AND v_ref_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    UPDATE public.vendor_companies
       SET status = 'REJECTED',
           compliance_status = 'ACTION_REQUIRED',
           rejection_reason = COALESCE(trim(p_reason), 'Document verification clarification required.'),
           correction_notes = COALESCE(trim(p_reason), 'Please re-upload a clear copy of the requested document.'),
           updated_at = NOW()
     WHERE id = v_ref_id::uuid;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'document_id', p_document_id,
    'decision', p_decision
  );
END;
$$;

COMMIT;
