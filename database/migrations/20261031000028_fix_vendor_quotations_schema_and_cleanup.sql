-- ============================================================================
-- Migration: 20261031000028_fix_vendor_quotations_schema_and_cleanup.sql
-- Description: THE TRUCKX - Add Canonical quotation_code to vendor_quotations Table
-- Canonical Format: TRUCKX-QT-DDMMYYYY-XXXXX
-- Date: 2026-10-31
-- ============================================================================

DO $$
BEGIN
    -- 1. Ensure quotation_code exists on public.vendor_quotations
    IF TO_REGCLASS('public.vendor_quotations') IS NOT NULL THEN

        ALTER TABLE public.vendor_quotations
            ADD COLUMN IF NOT EXISTS quotation_code TEXT;

        -- Create unique sparse index for fast lookups and deduplication
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_quotations_quotation_code
            ON public.vendor_quotations (quotation_code)
            WHERE quotation_code IS NOT NULL;

        -- 2. Backfill existing vendor quotations with canonical code if null
        UPDATE public.vendor_quotations
        SET quotation_code = 'TRUCKX-QT-' || TO_CHAR(COALESCE(submitted_at, NOW()), 'DDMMYYYY') || '-' || LPAD(SUBSTRING(id::text, 1, 5), 5, '0')
        WHERE quotation_code IS NULL;

        RAISE NOTICE 'Successfully added and backfilled quotation_code on public.vendor_quotations';

    ELSE
        RAISE NOTICE 'Table public.vendor_quotations does not exist. Skipping migration.';
    END IF;

    -- 3. Ensure drivers foreign key constraint to vendor_companies exists for PostgREST embedded joins
    IF TO_REGCLASS('public.drivers') IS NOT NULL AND TO_REGCLASS('public.vendor_companies') IS NOT NULL THEN
        -- Add constraint only if not present
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_drivers_primary_vendor_id'
              AND table_schema = 'public'
              AND table_name = 'drivers'
        ) THEN
            ALTER TABLE public.drivers
                ADD CONSTRAINT fk_drivers_primary_vendor_id
                FOREIGN KEY (primary_vendor_id)
                REFERENCES public.vendor_companies(id)
                ON DELETE SET NULL;
            RAISE NOTICE 'Added foreign key fk_drivers_primary_vendor_id on public.drivers';
        END IF;
    END IF;

    -- 4. Notify PostgREST to reload schema cache
    BEGIN
        PERFORM pg_notify('pgrst', 'reload schema');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

END $$;

