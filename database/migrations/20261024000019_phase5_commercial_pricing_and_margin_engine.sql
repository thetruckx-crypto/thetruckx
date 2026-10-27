-- ============================================================================
-- Migration: 20261024000019_phase5_commercial_pricing_and_margin_engine.sql
-- Description: Phase 5 Commercial Pricing & NECL Margin Engine:
--              1. Extends client_quotes with vendor_quotation link, margin_type,
--                 margin_percent, extra_charges, charge_details, and issued_by.
--              2. Extends vendor_quotations with transit_days, notes, and valid_until.
--              3. Creates composite performance indexes on client_quotes and vendor_quotations.
--              4. Defines RPC for secure client quote creation with commercial margin calculation.
--              5. Grants appropriate execution privileges.
-- ============================================================================

DO $$
BEGIN

  -- 1. Extend client_quotes table
  IF to_regclass('public.client_quotes') IS NOT NULL THEN
    ALTER TABLE public.client_quotes
      ADD COLUMN IF NOT EXISTS vendor_quotation_id UUID,
      ADD COLUMN IF NOT EXISTS margin_type TEXT DEFAULT 'FIXED',
      ADD COLUMN IF NOT EXISTS margin_percent NUMERIC,
      ADD COLUMN IF NOT EXISTS extra_charges NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS charge_details JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
      ADD COLUMN IF NOT EXISTS issued_by UUID,
      ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;

    -- Indexes for client quotes
    CREATE INDEX IF NOT EXISTS idx_client_quotes_req_version
      ON public.client_quotes (requirement_id, version);

    CREATE INDEX IF NOT EXISTS idx_client_quotes_status_validity
      ON public.client_quotes (status, validity_expires_at);
  END IF;

  -- 2. Extend vendor_quotations table
  IF to_regclass('public.vendor_quotations') IS NOT NULL THEN
    ALTER TABLE public.vendor_quotations
      ADD COLUMN IF NOT EXISTS transit_days INTEGER,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

    -- Indexes for vendor quotations
    CREATE INDEX IF NOT EXISTS idx_vendor_quotations_vr_version
      ON public.vendor_quotations (vendor_request_id, version);

    CREATE INDEX IF NOT EXISTS idx_vendor_quotations_locked
      ON public.vendor_quotations (is_locked);
  END IF;

END $$;

-- ---------------------------------------------------------------------------
-- 3. STORED PROCEDURE: Calculate and Create Client Quotation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_client_quotation(
  p_requirement_id TEXT,
  p_vendor_quotation_id UUID,
  p_margin_type TEXT,            -- 'PERCENT' or 'FIXED'
  p_margin_value NUMERIC,         -- percentage e.g. 10, or fixed e.g. 5000
  p_extra_charges NUMERIC DEFAULT 0,
  p_gst_rate_percent NUMERIC DEFAULT 18,
  p_validity_days INTEGER DEFAULT 7,
  p_terms TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vq RECORD;
  v_req RECORD;
  v_vendor_cost NUMERIC;
  v_calculated_margin NUMERIC;
  v_taxable_base NUMERIC;
  v_gst_amount NUMERIC;
  v_total_client_amount NUMERIC;
  v_version INTEGER := 1;
  v_validity TIMESTAMPTZ;
  v_quote_id UUID;
  v_existing_max_version INTEGER;
BEGIN
  -- 1. Input parameter validation
  IF p_requirement_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PARAM', 'message', 'Requirement ID is mandatory.');
  END IF;

  IF p_margin_value IS NULL OR p_margin_value < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_MARGIN', 'message', 'Commercial margin cannot be negative.');
  END IF;

  -- 2. Validate requirement exists
  SELECT * INTO v_req FROM public.requirements WHERE id = p_requirement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'REQUIREMENT_NOT_FOUND', 'message', 'Requirement not found.');
  END IF;

  -- 3. Fetch vendor quote base cost
  IF p_vendor_quotation_id IS NOT NULL THEN
    SELECT * INTO v_vq FROM public.vendor_quotations WHERE id = p_vendor_quotation_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'VENDOR_QUOTE_NOT_FOUND', 'message', 'Selected vendor quotation not found.');
    END IF;
    v_vendor_cost := COALESCE(v_vq.quoted_rate, 0);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'VENDOR_QUOTE_REQUIRED', 'message', 'Vendor quotation ID is required.');
  END IF;

  IF v_vendor_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_VENDOR_COST', 'message', 'Vendor base cost must be greater than zero.');
  END IF;

  -- 4. Calculate Margin
  IF p_margin_type = 'PERCENT' THEN
    v_calculated_margin := ROUND((v_vendor_cost * (p_margin_value / 100.0)), 2);
  ELSE
    v_calculated_margin := ROUND(p_margin_value, 2);
  END IF;

  -- 5. Calculate Taxable Base & GST
  v_taxable_base := ROUND((v_vendor_cost + v_calculated_margin + COALESCE(p_extra_charges, 0)), 2);
  v_gst_amount := ROUND((v_taxable_base * (COALESCE(p_gst_rate_percent, 18) / 100.0)), 2);
  v_total_client_amount := ROUND((v_taxable_base + v_gst_amount), 2);

  -- 6. Compute Next Version
  SELECT COALESCE(MAX(version), 0) INTO v_existing_max_version
  FROM public.client_quotes
  WHERE requirement_id = p_requirement_id;

  v_version := v_existing_max_version + 1;
  v_validity := NOW() + (COALESCE(p_validity_days, 7) || ' days')::INTERVAL;
  v_quote_id := gen_random_uuid();

  -- 7. Insert Client Quote
  INSERT INTO public.client_quotes (
    id,
    requirement_id,
    version,
    vendor_base_cost,
    admin_margin,
    gst_rate_percent,
    gst_amount,
    total_client_amount,
    validity_expires_at,
    status,
    vendor_quotation_id,
    margin_type,
    margin_percent,
    extra_charges,
    terms_and_conditions,
    issued_by,
    issued_at,
    created_at
  ) VALUES (
    v_quote_id,
    p_requirement_id,
    v_version,
    v_vendor_cost,
    v_calculated_margin,
    p_gst_rate_percent,
    v_gst_amount,
    v_total_client_amount,
    v_validity,
    'SENT',
    p_vendor_quotation_id,
    p_margin_type,
    CASE WHEN p_margin_type = 'PERCENT' THEN p_margin_value ELSE ROUND((v_calculated_margin / v_vendor_cost) * 100, 2) END,
    COALESCE(p_extra_charges, 0),
    p_terms,
    p_admin_user_id,
    NOW(),
    NOW()
  );

  -- 8. Lock the winning vendor quotation
  UPDATE public.vendor_quotations
  SET is_locked = TRUE
  WHERE id = p_vendor_quotation_id;

  -- 9. Update requirement status to QUOTED
  UPDATE public.requirements
  SET status = 'QUOTED', updated_at = NOW()
  WHERE id = p_requirement_id;

  -- 10. Audit Log
  INSERT INTO public.auth_audit_log (
    user_id,
    user_type,
    event_type,
    details
  ) VALUES (
    COALESCE(p_admin_user_id, '00000000-0000-0000-0000-000000000001'::uuid),
    'ADMIN',
    'CLIENT_QUOTE_ISSUED',
    jsonb_build_object(
      'quote_id', v_quote_id,
      'requirement_id', p_requirement_id,
      'version', v_version,
      'vendor_base_cost', v_vendor_cost,
      'admin_margin', v_calculated_margin,
      'margin_type', p_margin_type,
      'total_client_amount', v_total_client_amount,
      'validity_expires_at', v_validity
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'quote_id', v_quote_id,
    'version', v_version,
    'vendor_base_cost', v_vendor_cost,
    'admin_margin', v_calculated_margin,
    'taxable_base', v_taxable_base,
    'gst_amount', v_gst_amount,
    'total_client_amount', v_total_client_amount,
    'validity_expires_at', v_validity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_client_quotation TO authenticated, service_role;
