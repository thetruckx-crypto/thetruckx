
-- Migration: 20261030000026_the_truckx_unified_id_management.sql
-- Description: THE TRUCKX Unified ID Management & Sequence Architecture
-- Format: TRUCKX-[ENTITY_CODE]-DDMMYYYY-XXXXX
-- Timezone: Asia/Kolkata (IST)
--
-- Entity Codes:
--   AC  -> Account
--   CL  -> Client Company
--   VE  -> Vendor
--   DR  -> Driver
--   REQ -> Transport Requirement
--   QT  -> Commercial Quotation
--   BK  -> Booking Confirmation
--   VH  -> Fleet Vehicle
--   TR  -> Consignment Trip / Shipment
-- ============================================================================


-- ============================================================================
-- 1. ID SEQUENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.truckx_id_sequences (
    entity_type TEXT NOT NULL,
    date_key TEXT NOT NULL,
    current_val INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT truckx_id_sequences_pkey
        PRIMARY KEY (entity_type, date_key),

    CONSTRAINT truckx_id_sequences_current_val_check
        CHECK (current_val >= 0)
);

ALTER TABLE public.truckx_id_sequences ENABLE ROW LEVEL SECURITY;

-- Remove legacy policies if present.
DROP POLICY IF EXISTS "truckx_id_sequences_all"
    ON public.truckx_id_sequences;

-- Only trusted backend roles should access sequence counters directly.
-- ID generation is performed through SECURITY DEFINER functions.
REVOKE ALL ON TABLE public.truckx_id_sequences
    FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.truckx_id_sequences
    TO service_role;

-- Do not create a permissive RLS policy for anon/authenticated.
-- The SECURITY DEFINER function below handles sequence updates.


-- ============================================================================
-- 2. ATOMIC ID GENERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_truckx_id(
    p_entity_type TEXT,
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_prefix TEXT;
    v_date_key TEXT;
    v_next_val INTEGER;
    v_padded_seq TEXT;
    v_timestamp TIMESTAMPTZ;
BEGIN
    -- Validate inputs.
    IF p_entity_type IS NULL OR BTRIM(p_entity_type) = '' THEN
        RAISE EXCEPTION 'Entity type cannot be empty';
    END IF;

    v_timestamp := COALESCE(p_timestamp, NOW());

    -- Normalize entity type and support legacy aliases.
    v_prefix := UPPER(BTRIM(p_entity_type));

    CASE v_prefix
        WHEN 'ACCOUNT' THEN v_prefix := 'AC';
        WHEN 'ACC' THEN v_prefix := 'AC';
        WHEN 'ACT' THEN v_prefix := 'AC';

        WHEN 'CLIENT' THEN v_prefix := 'CL';
        WHEN 'CLI' THEN v_prefix := 'CL';

        WHEN 'VENDOR' THEN v_prefix := 'VE';
        WHEN 'VD' THEN v_prefix := 'VE';
        WHEN 'VND' THEN v_prefix := 'VE';

        WHEN 'DRIVER' THEN v_prefix := 'DR';
        WHEN 'DRV' THEN v_prefix := 'DR';

        WHEN 'REQUIREMENT' THEN v_prefix := 'REQ';

        WHEN 'QUOTATION' THEN v_prefix := 'QT';
        WHEN 'QUOTE' THEN v_prefix := 'QT';
        WHEN 'QTE' THEN v_prefix := 'QT';

        WHEN 'BOOKING' THEN v_prefix := 'BK';
        WHEN 'BOK' THEN v_prefix := 'BK';

        WHEN 'VEHICLE' THEN v_prefix := 'VH';
        WHEN 'VEH' THEN v_prefix := 'VH';

        WHEN 'TRIP' THEN v_prefix := 'TR';
        WHEN 'TRP' THEN v_prefix := 'TR';
        WHEN 'SHP' THEN v_prefix := 'TR';
    END CASE;

    -- Reject unsupported entity codes.
    IF v_prefix NOT IN (
        'AC', 'CL', 'VE', 'DR', 'REQ',
        'QT', 'BK', 'VH', 'TR'
    ) THEN
        RAISE EXCEPTION 'Unsupported THE TRUCKX entity type: %',
            p_entity_type;
    END IF;

    -- Convert the timestamp to India local time and format DDMMYYYY.
    v_date_key := TO_CHAR(
        v_timestamp AT TIME ZONE 'Asia/Kolkata',
        'DDMMYYYY'
    );

    -- Atomic increment for each entity and India-local calendar date.
    INSERT INTO public.truckx_id_sequences AS seq (
        entity_type,
        date_key,
        current_val,
        updated_at
    )
    VALUES (
        v_prefix,
        v_date_key,
        1,
        NOW()
    )
    ON CONFLICT (entity_type, date_key)
    DO UPDATE SET
        current_val = seq.current_val + 1,
        updated_at = NOW()
    RETURNING current_val INTO v_next_val;

    -- Five-digit sequence; do not silently generate malformed IDs.
    IF v_next_val > 99999 THEN
        RAISE EXCEPTION
            'Daily sequence limit exceeded for entity % on %',
            v_prefix,
            v_date_key;
    END IF;

    v_padded_seq := LPAD(v_next_val::TEXT, 5, '0');

    RETURN 'TRUCKX-' || v_prefix || '-' ||
           v_date_key || '-' || v_padded_seq;
END;
$function$;


-- ============================================================================
-- 3. FUNCTION PERMISSIONS
-- ============================================================================

REVOKE ALL ON FUNCTION public.generate_truckx_id(TEXT, TIMESTAMPTZ)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_truckx_id(TEXT, TIMESTAMPTZ)
    TO authenticated, service_role;


-- ============================================================================
-- 4. BACKWARD-COMPATIBILITY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_necl_id(
    p_entity_type TEXT,
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    RETURN public.generate_truckx_id(
        p_entity_type,
        COALESCE(p_timestamp, NOW())
    );
END;
$function$;


REVOKE ALL ON FUNCTION public.generate_necl_id(TEXT, TIMESTAMPTZ)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_necl_id(TEXT, TIMESTAMPTZ)
    TO authenticated, service_role;


-- ============================================================================
-- 5. SCHEMA INTEGRITY: ACCOUNT AND ENTITY CODE COLUMNS
-- ============================================================================

DO $migration$
BEGIN

    -- ------------------------------------------------------------------------
    -- 5.1 CLIENT USERS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.client_users') IS NOT NULL THEN

        ALTER TABLE public.client_users
            ADD COLUMN IF NOT EXISTS account_id TEXT;

        CREATE INDEX IF NOT EXISTS idx_client_users_account_id
            ON public.client_users (account_id)
            WHERE account_id IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.2 CLIENT COMPANIES
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.client_companies') IS NOT NULL THEN

        ALTER TABLE public.client_companies
            ADD COLUMN IF NOT EXISTS client_code TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_client_companies_client_code
            ON public.client_companies (client_code)
            WHERE client_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.3 VENDOR COMPANIES
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.vendor_companies') IS NOT NULL THEN

        ALTER TABLE public.vendor_companies
            ADD COLUMN IF NOT EXISTS vendor_code TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_companies_vendor_code
            ON public.vendor_companies (vendor_code)
            WHERE vendor_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.4 VENDORS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.vendors') IS NOT NULL THEN

        ALTER TABLE public.vendors
            ADD COLUMN IF NOT EXISTS vendor_code TEXT;

        CREATE INDEX IF NOT EXISTS idx_vendors_vendor_code
            ON public.vendors (vendor_code)
            WHERE vendor_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.5 VENDOR USERS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.vendor_users') IS NOT NULL THEN

        ALTER TABLE public.vendor_users
            ADD COLUMN IF NOT EXISTS account_id TEXT;

        CREATE INDEX IF NOT EXISTS idx_vendor_users_account_id
            ON public.vendor_users (account_id)
            WHERE account_id IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.6 DRIVERS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.drivers') IS NOT NULL THEN

        ALTER TABLE public.drivers
            ADD COLUMN IF NOT EXISTS driver_code TEXT;

        ALTER TABLE public.drivers
            ADD COLUMN IF NOT EXISTS account_id TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_driver_code
            ON public.drivers (driver_code)
            WHERE driver_code IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_drivers_account_id
            ON public.drivers (account_id)
            WHERE account_id IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.7 VEHICLES
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.vehicles') IS NOT NULL THEN

        ALTER TABLE public.vehicles
            ADD COLUMN IF NOT EXISTS vehicle_code TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_vehicle_code
            ON public.vehicles (vehicle_code)
            WHERE vehicle_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.8 TRANSPORT REQUIREMENTS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.requirements') IS NOT NULL THEN

        ALTER TABLE public.requirements
            ADD COLUMN IF NOT EXISTS requirement_code TEXT;

        CREATE INDEX IF NOT EXISTS idx_requirements_requirement_code
            ON public.requirements (requirement_code)
            WHERE requirement_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.9 CLIENT QUOTATIONS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.client_quotes') IS NOT NULL THEN

        ALTER TABLE public.client_quotes
            ADD COLUMN IF NOT EXISTS quote_code TEXT;

        CREATE INDEX IF NOT EXISTS idx_client_quotes_quote_code
            ON public.client_quotes (quote_code)
            WHERE quote_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.10 BOOKINGS
    -- FIX: Ensure booking_number exists before indexing it.
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.bookings') IS NOT NULL THEN

        ALTER TABLE public.bookings
            ADD COLUMN IF NOT EXISTS booking_number TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_booking_number
            ON public.bookings (booking_number)
            WHERE booking_number IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.11 TRIPS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.trips') IS NOT NULL THEN

        ALTER TABLE public.trips
            ADD COLUMN IF NOT EXISTS trip_code TEXT;

        CREATE INDEX IF NOT EXISTS idx_trips_trip_code
            ON public.trips (trip_code)
            WHERE trip_code IS NOT NULL;

    END IF;


    -- ------------------------------------------------------------------------
    -- 5.12 AUTH SESSIONS
    -- ------------------------------------------------------------------------

    IF TO_REGCLASS('public.auth_sessions') IS NOT NULL THEN

        ALTER TABLE public.auth_sessions
            ADD COLUMN IF NOT EXISTS account_id TEXT;

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_account_id
            ON public.auth_sessions (account_id)
            WHERE account_id IS NOT NULL;

    END IF;

END;
$migration$;


-- ============================================================================
-- 6. BASIC VALIDATION
-- ============================================================================

DO $validation$
BEGIN

    IF TO_REGCLASS('public.truckx_id_sequences') IS NULL THEN
        RAISE EXCEPTION 'Missing required table: public.truckx_id_sequences';
    END IF;

    IF TO_REGPROCEDURE(
        'public.generate_truckx_id(text,timestamp with time zone)'
    ) IS NULL THEN
        RAISE EXCEPTION 'Missing required function: generate_truckx_id';
    END IF;

    RAISE NOTICE
        'THE TRUCKX Unified ID Management migration completed successfully.';

END;
$validation$;


-- ============================================================================
-- 7. OPTIONAL MANUAL TESTS
-- Run separately after the migration if desired.
-- Do not run these statements as part of the migration itself.
-- ============================================================================

-- SELECT public.generate_truckx_id('AC');
-- SELECT public.generate_truckx_id('CL');
-- SELECT public.generate_truckx_id('VE');
-- SELECT public.generate_truckx_id('DR');
-- SELECT public.generate_truckx_id('REQ');
-- SELECT public.generate_truckx_id('QT');
-- SELECT public.generate_truckx_id('BK');
-- SELECT public.generate_truckx_id('VH');
-- SELECT public.generate_truckx_id('TR');

-- Backward compatibility:
-- SELECT public.generate_necl_id('BOOKING');

-- Inspect generated sequence counters:
-- SELECT *
-- FROM public.truckx_id_sequences
-- ORDER BY date_key DESC, entity_type;

