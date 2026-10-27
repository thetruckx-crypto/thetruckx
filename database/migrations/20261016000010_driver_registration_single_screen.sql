-- ============================================================================
-- Migration: 20261016000010_driver_registration_single_screen.sql
-- Description: Ensures drivers table supports date_of_birth, vendor association,
--              optional email on vendor_users and drivers, and doc_side on documents.
-- ============================================================================

DO $$
BEGIN
  -- 1. Ensure email is optional on vendor_users
  IF to_regclass('public.vendor_users') IS NOT NULL THEN
    ALTER TABLE public.vendor_users ALTER COLUMN email DROP NOT NULL;
  END IF;

  -- 2. Ensure drivers table supports single-screen registration fields & optional email
  IF to_regclass('public.drivers') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'email'
    ) THEN
      ALTER TABLE public.drivers ALTER COLUMN email DROP NOT NULL;
    END IF;

    ALTER TABLE public.drivers
      ADD COLUMN IF NOT EXISTS date_of_birth DATE,
      ADD COLUMN IF NOT EXISTS dob TEXT,
      ADD COLUMN IF NOT EXISTS primary_vendor_id UUID,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

    -- Add index on primary_vendor_id if not exists
    CREATE INDEX IF NOT EXISTS idx_drivers_primary_vendor_id
      ON public.drivers(primary_vendor_id)
      WHERE primary_vendor_id IS NOT NULL;
  END IF;

  -- 3. Ensure documents table supports doc_side (FRONT, BACK)
  IF to_regclass('public.documents') IS NOT NULL THEN
    ALTER TABLE public.documents
      ADD COLUMN IF NOT EXISTS doc_side TEXT;
  END IF;
END $$;
