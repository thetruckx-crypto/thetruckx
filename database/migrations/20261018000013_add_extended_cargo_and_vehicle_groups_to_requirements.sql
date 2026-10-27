-- ============================================================================
-- Migration: 20261018000013_add_extended_cargo_and_vehicle_groups_to_requirements.sql
-- Description: Extends requirements table with structured vehicle groups,
--              optional cargo specifications, hazchem details, and loading-point
--              declared vs verified measurements.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.requirements') IS NOT NULL THEN

    -- 1. Multi-vehicle specifications
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS vehicle_groups JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS total_vehicles_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS total_requirement_entries_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS budget_scope TEXT,
      ADD COLUMN IF NOT EXISTS target_budget TEXT;

    -- 2. Cargo Weight, Quantity & Packaging
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS commodity_type TEXT,
      ADD COLUMN IF NOT EXISTS total_cargo_weight NUMERIC,
      ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'MT',
      ADD COLUMN IF NOT EXISTS total_quantity INTEGER,
      ADD COLUMN IF NOT EXISTS unit_count INTEGER,
      ADD COLUMN IF NOT EXISTS package_type TEXT,
      ADD COLUMN IF NOT EXISTS package_mode TEXT,
      ADD COLUMN IF NOT EXISTS package_description TEXT;

    -- 3. Hazardous Cargo (Hazchem) Specifications
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS is_hazardous BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS hazardous_material_name TEXT,
      ADD COLUMN IF NOT EXISTS hazard_class TEXT,
      ADD COLUMN IF NOT EXISTS un_number TEXT,
      ADD COLUMN IF NOT EXISTS packing_group TEXT,
      ADD COLUMN IF NOT EXISTS safety_handling_instructions TEXT,
      ADD COLUMN IF NOT EXISTS required_precautions TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
      ADD COLUMN IF NOT EXISTS emergency_instructions TEXT,
      ADD COLUMN IF NOT EXISTS additional_hazardous_info TEXT;

    -- 4. Cargo Dimensions & Properties
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS cargo_length NUMERIC,
      ADD COLUMN IF NOT EXISTS cargo_width NUMERIC,
      ADD COLUMN IF NOT EXISTS cargo_height NUMERIC,
      ADD COLUMN IF NOT EXISTS dimension_unit TEXT DEFAULT 'ft',
      ADD COLUMN IF NOT EXISTS cargo_volume NUMERIC,
      ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_stackable BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_oversized BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_moisture_sensitive BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_temperature_controlled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS min_temperature NUMERIC,
      ADD COLUMN IF NOT EXISTS max_temperature NUMERIC,
      ADD COLUMN IF NOT EXISTS special_handling_instructions TEXT;

    -- 5. Loading-Point Declared vs Verified Measurements
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS loading_point_weight_declared NUMERIC,
      ADD COLUMN IF NOT EXISTS loading_point_quantity_declared INTEGER,
      ADD COLUMN IF NOT EXISTS loading_point_verified_weight NUMERIC,
      ADD COLUMN IF NOT EXISTS loading_point_verified_quantity INTEGER,
      ADD COLUMN IF NOT EXISTS is_measurement_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS measurement_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS measurement_verified_by UUID;

    -- Index on hazchem and verified flags for fast querying
    CREATE INDEX IF NOT EXISTS idx_requirements_is_hazardous
      ON public.requirements(is_hazardous) WHERE is_hazardous IS TRUE;

    CREATE INDEX IF NOT EXISTS idx_requirements_measurement_verified
      ON public.requirements(is_measurement_verified);

  END IF;
END $$;
