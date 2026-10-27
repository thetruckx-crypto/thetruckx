-- ============================================================================
-- Migration: 20261019000015_add_quantity_unit_and_vendor_hub_optimizations.sql
-- Description: Adds quantity_unit and material_description to requirements table,
--              and operating_routes array to vendor_companies table.
-- ============================================================================

DO $$
BEGIN
  -- 1. Extend requirements table with quantity_unit and material_description
  IF to_regclass('public.requirements') IS NOT NULL THEN
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS quantity_unit TEXT,
      ADD COLUMN IF NOT EXISTS material_description TEXT;
  END IF;

  -- 2. Extend vendor_companies table with operating_routes
  IF to_regclass('public.vendor_companies') IS NOT NULL THEN
    ALTER TABLE public.vendor_companies
      ADD COLUMN IF NOT EXISTS operating_routes TEXT[] DEFAULT '{}'::text[];
  END IF;

  -- 3. Ensure regional_hubs table has unique constraint or index on (lower(name), lower(city))
  IF to_regclass('public.regional_hubs') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_hubs_name_city_unique
      ON public.regional_hubs (lower(trim(name)), lower(trim(city)));
  END IF;
END $$;
