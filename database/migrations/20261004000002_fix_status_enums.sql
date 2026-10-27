-- Migration: Fix status enums to include INACTIVE
-- Date: 2026-10-04
-- Description: Adds INACTIVE status to vendor_companies and drivers tables

-- Fix vendor_companies status constraint
ALTER TABLE public.vendor_companies 
  DROP CONSTRAINT IF EXISTS vendor_companies_status_check;

ALTER TABLE public.vendor_companies 
  ADD CONSTRAINT vendor_companies_status_check 
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE'));

-- Fix drivers status constraint
ALTER TABLE public.drivers 
  DROP CONSTRAINT IF EXISTS drivers_status_check;

ALTER TABLE public.drivers 
  ADD CONSTRAINT drivers_status_check 
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE'));

-- Comments
COMMENT ON CONSTRAINT vendor_companies_status_check ON public.vendor_companies 
  IS 'Valid statuses: PENDING, APPROVED, REJECTED, SUSPENDED, INACTIVE';

COMMENT ON CONSTRAINT drivers_status_check ON public.drivers 
  IS 'Valid statuses: PENDING, APPROVED, REJECTED, INACTIVE';
