-- ============================================================================
-- NECL MIGRATION: 20261015000009_necl_unique_id_and_client_registration_upgrade.sql
-- Date: 2026-10-15
-- Description:
--   1. Creates atomic concurrency-safe NECL Unique ID sequence generator
--      Format: NECL-[ENTITY_CODE]-DDMMYYYY-XXXXX (Date in Asia/Kolkata timezone)
--   2. Extends client_companies with Company PAN, profile completion tracking,
--      document upload responsibility configuration, and lifetime booking metrics
--   3. Adds get_client_lifetime_metrics function calculated from actual bookings
--   4. Updates documents table to support PENDING_UPLOAD status and responsibility metadata
--   5. Adds unique code columns to core operational entities
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. ATOMIC NECL UNIQUE ID GENERATION SYSTEM
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.necl_id_sequences (
  entity_type TEXT NOT NULL,
  date_key TEXT NOT NULL, -- DDMMYYYY in Asia/Kolkata
  current_val INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, date_key)
);

ALTER TABLE public.necl_id_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "necl_id_sequences_all" ON public.necl_id_sequences;
CREATE POLICY "necl_id_sequences_all" ON public.necl_id_sequences
  FOR ALL TO authenticated, service_role, anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.necl_id_sequences TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.necl_id_sequences TO anon;

-- Concurrency-safe atomic generation function
CREATE OR REPLACE FUNCTION public.generate_necl_id(
  p_entity_type TEXT,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ist_timestamp TIMESTAMPTZ;
  v_date_key TEXT;
  v_next_val INTEGER;
  v_padded_seq TEXT;
  v_prefix TEXT;
BEGIN
  -- Normalize prefix
  v_prefix := upper(trim(p_entity_type));

  -- Convert timestamp to Asia/Kolkata timezone (IST)
  v_ist_timestamp := timezone('Asia/Kolkata', p_timestamp);
  v_date_key := to_char(v_ist_timestamp, 'DDMMYYYY');

  -- Atomically increment counter for (entity_type, date_key)
  INSERT INTO public.necl_id_sequences (entity_type, date_key, current_val, updated_at)
  VALUES (v_prefix, v_date_key, 1, NOW())
  ON CONFLICT (entity_type, date_key)
  DO UPDATE SET current_val = public.necl_id_sequences.current_val + 1,
                updated_at = NOW()
  RETURNING current_val INTO v_next_val;

  -- 5-digit zero-padded sequence
  v_padded_seq := lpad(v_next_val::TEXT, 5, '0');

  RETURN 'NECL-' || v_prefix || '-' || v_date_key || '-' || v_padded_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_necl_id(TEXT, TIMESTAMPTZ) TO public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 2. EXTEND client_companies FOR REGISTRATION UPGRADE & LIFETIME METRICS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.client_companies') IS NOT NULL THEN

    -- Company PAN Number
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS pan TEXT;

    -- Profile completion tracking
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS profile_completion_status TEXT DEFAULT 'COMPLETE',
      ADD COLUMN IF NOT EXISTS incomplete_fields JSONB DEFAULT '[]'::jsonb;

    -- Configurable document upload responsibility
    -- E.g. {"GST_CERTIFICATE": "ADMIN", "COMPANY_PAN": "CLIENT", ...}
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS document_upload_responsibility JSONB DEFAULT '{}'::jsonb;

    -- Real lifetime booking metrics (calculated from database records)
    ALTER TABLE public.client_companies
      ADD COLUMN IF NOT EXISTS lifetime_bookings INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS confirmed_bookings INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completed_bookings INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cancelled_bookings INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_booking_at TIMESTAMPTZ;

    -- Update or drop legacy status constraint if present to allow PENDING_DOCUMENTS
    ALTER TABLE public.client_companies
      DROP CONSTRAINT IF EXISTS client_companies_status_check;

    ALTER TABLE public.client_companies
      ADD CONSTRAINT client_companies_status_check
      CHECK (status IN (
        'PENDING_APPROVAL',
        'PENDING_DOCUMENTS',
        'PENDING_COMPLETION',
        'APPROVED',
        'REJECTED',
        'CORRECTIONS_REQUESTED',
        'SUSPENDED',
        'ACTIVE',
        'INACTIVE'
      ));

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_client_companies_pan
      ON public.client_companies(pan)
      WHERE pan IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_companies_profile_completion
      ON public.client_companies(profile_completion_status);

  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 3. FUNCTION TO CALCULATE REAL CLIENT LIFETIME BOOKING METRICS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_lifetime_metrics(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
  v_confirmed INTEGER := 0;
  v_completed INTEGER := 0;
  v_cancelled INTEGER := 0;
  v_last_booking TIMESTAMPTZ := NULL;
  v_res JSONB;
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE booking_status IN ('CONFIRMED', 'ASSIGNED', 'IN_TRANSIT', 'DISPATCHED')),
      count(*) FILTER (WHERE booking_status IN ('COMPLETED', 'DELIVERED', 'CLOSED')),
      count(*) FILTER (WHERE booking_status IN ('CANCELLED', 'REJECTED')),
      max(created_at)
    INTO
      v_total,
      v_confirmed,
      v_completed,
      v_cancelled,
      v_last_booking
    FROM public.bookings
    WHERE client_id = p_client_id::TEXT;
  END IF;

  -- Persist calculated metrics to client_companies
  UPDATE public.client_companies
     SET lifetime_bookings = v_total,
         confirmed_bookings = v_confirmed,
         completed_bookings = v_completed,
         cancelled_bookings = v_cancelled,
         last_booking_at = v_last_booking,
         updated_at = NOW()
   WHERE id = p_client_id;

  v_res := jsonb_build_object(
    'client_id', p_client_id,
    'lifetime_bookings', v_total,
    'confirmed_bookings', v_confirmed,
    'completed_bookings', v_completed,
    'cancelled_bookings', v_cancelled,
    'last_booking_at', v_last_booking
  );

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_lifetime_metrics(UUID) TO public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4. UPDATE documents TABLE FOR RESPONSIBILITY & PENDING_UPLOAD STATUS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.documents') IS NOT NULL THEN

    ALTER TABLE public.documents
      ADD COLUMN IF NOT EXISTS document_code TEXT,
      ADD COLUMN IF NOT EXISTS upload_responsibility TEXT DEFAULT 'ADMIN', -- 'ADMIN' | 'CLIENT'
      ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

    -- Update verification status check to include PENDING_UPLOAD
    ALTER TABLE public.documents
      DROP CONSTRAINT IF EXISTS documents_verification_status_check;

    ALTER TABLE public.documents
      ADD CONSTRAINT documents_verification_status_check
      CHECK (verification_status IN (
        'PENDING_UPLOAD',
        'PENDING',
        'UNDER_REVIEW',
        'VERIFIED',
        'APPROVED',
        'REJECTED',
        'REPLACEMENT_REQUESTED'
      ));

    CREATE INDEX IF NOT EXISTS idx_documents_upload_resp
      ON public.documents(upload_responsibility);

  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 5. ADD NECL CODE COLUMNS TO CORE ENTITIES (IF NOT PRESENT)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Requirements
  IF to_regclass('public.requirements') IS NOT NULL THEN
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS requirement_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_requirements_code
      ON public.requirements(requirement_code) WHERE requirement_code IS NOT NULL;
  END IF;

  -- Bookings
  IF to_regclass('public.bookings') IS NOT NULL THEN
    ALTER TABLE public.bookings
      ADD COLUMN IF NOT EXISTS booking_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_bookings_code
      ON public.bookings(booking_code) WHERE booking_code IS NOT NULL;
  END IF;

  -- Vendor Companies
  IF to_regclass('public.vendor_companies') IS NOT NULL THEN
    ALTER TABLE public.vendor_companies
      ADD COLUMN IF NOT EXISTS vendor_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_vendor_companies_code
      ON public.vendor_companies(vendor_code) WHERE vendor_code IS NOT NULL;
  END IF;

  -- Drivers
  IF to_regclass('public.drivers') IS NOT NULL THEN
    ALTER TABLE public.drivers
      ADD COLUMN IF NOT EXISTS driver_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_drivers_code
      ON public.drivers(driver_code) WHERE driver_code IS NOT NULL;
  END IF;

  -- Vehicles
  IF to_regclass('public.vehicles') IS NOT NULL THEN
    ALTER TABLE public.vehicles
      ADD COLUMN IF NOT EXISTS vehicle_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_vehicles_code
      ON public.vehicles(vehicle_code) WHERE vehicle_code IS NOT NULL;
  END IF;
END $$;

COMMIT;
