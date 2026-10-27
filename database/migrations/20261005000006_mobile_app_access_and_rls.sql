-- ============================================================================
-- NECL MOBILE APP ACCESS & MULTI-ROLE RLS POLICIES
-- Migration: 20261005000006_mobile_app_access_and_rls.sql
--
-- Roles:
--   1. Client
--   2. Vendor
--   3. Driver
--   4. Admin (trusted backend / service_role)
--
-- Security:
--   - OTP operations are restricted to trusted server-side logic.
--   - Anonymous registration is supported.
--   - Sensitive registration records are not publicly readable.
--   - Authenticated users can read their own linked records.
--   - Admin operations should use a trusted backend.
-- ============================================================================


-- ============================================================================
-- 1. CREATE OTP VERIFICATION TABLE IF MISSING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'LOGIN',
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.otp_verifications
    ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_otp_verifications_mobile
    ON public.otp_verifications (mobile);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at
    ON public.otp_verifications (expires_at);


-- OTP data must not be directly accessible to anonymous or
-- authenticated clients. Perform OTP operations through trusted
-- server-side functions or an Edge Function.

DROP POLICY IF EXISTS "anon_insert_otp"
    ON public.otp_verifications;

DROP POLICY IF EXISTS "anon_select_otp"
    ON public.otp_verifications;

DROP POLICY IF EXISTS "anon_update_otp"
    ON public.otp_verifications;

DROP POLICY IF EXISTS "otp_server_only"
    ON public.otp_verifications;

CREATE POLICY "otp_server_only"
    ON public.otp_verifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON TABLE public.otp_verifications
    FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.otp_verifications
    TO service_role;


-- ============================================================================
-- 2. CREATE AUTH AUDIT LOG IF MISSING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    mobile TEXT,
    role TEXT,
    event_type TEXT NOT NULL,
    event_details JSONB NOT NULL DEFAULT '{}'::JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.auth_audit_log
    ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at
    ON public.auth_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id
    ON public.auth_audit_log (user_id);

DROP POLICY IF EXISTS "anon_insert_audit_log"
    ON public.auth_audit_log;

DROP POLICY IF EXISTS "audit_log_server_only"
    ON public.auth_audit_log;

CREATE POLICY "audit_log_server_only"
    ON public.auth_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON TABLE public.auth_audit_log
    FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.auth_audit_log
    TO service_role;


-- ============================================================================
-- 3. ENSURE DRIVER COLUMN COMPATIBILITY
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.drivers') IS NULL THEN
        RAISE NOTICE
            'public.drivers does not exist. Driver policies will be skipped.';
        RETURN;
    END IF;

    -- Ensure full_name exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'full_name'
    ) THEN
        ALTER TABLE public.drivers
            ADD COLUMN full_name TEXT;
    END IF;

    -- Synchronize name and full_name if both columns exist.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'name'
    ) THEN
        UPDATE public.drivers
        SET full_name = name
        WHERE full_name IS NULL
          AND name IS NOT NULL;
    END IF;

    -- Ensure mobile exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'mobile'
    ) THEN
        ALTER TABLE public.drivers
            ADD COLUMN mobile TEXT;
    END IF;

    -- Synchronize phone and mobile if phone exists.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'phone'
    ) THEN
        UPDATE public.drivers
        SET mobile = phone
        WHERE mobile IS NULL
          AND phone IS NOT NULL;
    END IF;

    -- Ensure licence_number exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'licence_number'
    ) THEN
        ALTER TABLE public.drivers
            ADD COLUMN licence_number TEXT;
    END IF;

    -- Synchronize license_number and licence_number.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'license_number'
    ) THEN
        UPDATE public.drivers
        SET licence_number = license_number
        WHERE licence_number IS NULL
          AND license_number IS NOT NULL;
    END IF;

    -- Ensure status exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.drivers
            ADD COLUMN status TEXT DEFAULT 'PENDING';
    END IF;

    -- Ensure vendor association exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'primary_vendor_id'
    ) THEN
        ALTER TABLE public.drivers
            ADD COLUMN primary_vendor_id UUID;
    END IF;

    -- Link the driver record to Supabase Auth.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE public.drivers
            ADD COLUMN auth_user_id UUID
            REFERENCES auth.users(id)
            ON DELETE SET NULL;
    END IF;

END $$;


-- ============================================================================
-- 4. ENSURE CLIENT USER COLUMN COMPATIBILITY
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.client_users') IS NULL THEN
        RAISE NOTICE
            'public.client_users does not exist. Client-user policies will be skipped.';
        RETURN;
    END IF;

    -- Ensure mobile exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'client_users'
          AND column_name = 'mobile'
    ) THEN
        ALTER TABLE public.client_users
            ADD COLUMN mobile TEXT;
    END IF;

    -- Ensure client_company_id exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'client_users'
          AND column_name = 'client_company_id'
    ) THEN
        ALTER TABLE public.client_users
            ADD COLUMN client_company_id UUID;

        -- Copy existing client_id values when the source column is UUID.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'client_users'
              AND column_name = 'client_id'
              AND udt_name = 'uuid'
        ) THEN
            UPDATE public.client_users
            SET client_company_id = client_id
            WHERE client_company_id IS NULL;
        END IF;
    END IF;

    -- Ensure Supabase Auth user association exists.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'client_users'
          AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE public.client_users
            ADD COLUMN auth_user_id UUID
            REFERENCES auth.users(id)
            ON DELETE SET NULL;
    END IF;

END $$;


-- ============================================================================
-- 5. ENSURE CLIENT COMPANY OWNERSHIP SUPPORT
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.client_companies') IS NOT NULL THEN

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'client_companies'
              AND column_name = 'auth_user_id'
        ) THEN
            ALTER TABLE public.client_companies
                ADD COLUMN auth_user_id UUID
                REFERENCES auth.users(id)
                ON DELETE SET NULL;
        END IF;

    ELSE
        RAISE NOTICE
            'public.client_companies does not exist. Client-company policies will be skipped.';
    END IF;
END $$;


-- ============================================================================
-- 6. ENSURE VENDOR COMPANY OWNERSHIP SUPPORT
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.vendor_companies') IS NOT NULL THEN

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'vendor_companies'
              AND column_name = 'auth_user_id'
        ) THEN
            ALTER TABLE public.vendor_companies
                ADD COLUMN auth_user_id UUID
                REFERENCES auth.users(id)
                ON DELETE SET NULL;
        END IF;

    ELSE
        RAISE NOTICE
            'public.vendor_companies does not exist. Vendor-company policies will be skipped.';
    END IF;
END $$;


-- ============================================================================
-- 7. ENABLE RLS ON BUSINESS TABLES
-- ============================================================================

DO $$
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'client_companies',
        'client_users',
        'drivers',
        'vendor_companies'
    ]
    LOOP
        IF to_regclass('public.' || v_table) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
                v_table
            );
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 8. CLIENT COMPANY POLICIES
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.client_companies') IS NULL THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "mobile_insert_client_company"
        ON public.client_companies;

    DROP POLICY IF EXISTS "mobile_select_client_company"
        ON public.client_companies;

    DROP POLICY IF EXISTS "client_company_register"
        ON public.client_companies;

    DROP POLICY IF EXISTS "client_company_read_own"
        ON public.client_companies;

    -- Registration only. Additional business validation must be performed
    -- by the trusted registration endpoint.
    CREATE POLICY "client_company_register"
        ON public.client_companies
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);

    -- Authenticated users can read only a company linked to their Auth ID.
    CREATE POLICY "client_company_read_own"
        ON public.client_companies
        FOR SELECT
        TO authenticated
        USING (auth_user_id = (SELECT auth.uid()));

END $$;


-- ============================================================================
-- 9. CLIENT USER POLICIES
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.client_users') IS NULL THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "mobile_insert_client_user"
        ON public.client_users;

    DROP POLICY IF EXISTS "mobile_select_client_user"
        ON public.client_users;

    DROP POLICY IF EXISTS "client_user_register"
        ON public.client_users;

    DROP POLICY IF EXISTS "client_user_read_own"
        ON public.client_users;

    CREATE POLICY "client_user_register"
        ON public.client_users
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);

    CREATE POLICY "client_user_read_own"
        ON public.client_users
        FOR SELECT
        TO authenticated
        USING (auth_user_id = (SELECT auth.uid()));

END $$;


-- ============================================================================
-- 10. DRIVER POLICIES
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.drivers') IS NULL THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "mobile_insert_driver"
        ON public.drivers;

    DROP POLICY IF EXISTS "mobile_select_driver"
        ON public.drivers;

    DROP POLICY IF EXISTS "driver_register"
        ON public.drivers;

    DROP POLICY IF EXISTS "driver_read_own"
        ON public.drivers;

    CREATE POLICY "driver_register"
        ON public.drivers
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);

    CREATE POLICY "driver_read_own"
        ON public.drivers
        FOR SELECT
        TO authenticated
        USING (auth_user_id = (SELECT auth.uid()));

END $$;


-- ============================================================================
-- 11. VENDOR COMPANY POLICIES
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('public.vendor_companies') IS NULL THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "mobile_insert_vendor"
        ON public.vendor_companies;

    DROP POLICY IF EXISTS "mobile_select_vendor"
        ON public.vendor_companies;

    DROP POLICY IF EXISTS "vendor_register"
        ON public.vendor_companies;

    DROP POLICY IF EXISTS "vendor_read_own"
        ON public.vendor_companies;

    CREATE POLICY "vendor_register"
        ON public.vendor_companies
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);

    CREATE POLICY "vendor_read_own"
        ON public.vendor_companies
        FOR SELECT
        TO authenticated
        USING (auth_user_id = (SELECT auth.uid()));

END $$;


-- ============================================================================
-- 12. GRANT REQUIRED REGISTRATION PERMISSIONS
-- ============================================================================

DO $$
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'client_companies',
        'client_users',
        'drivers',
        'vendor_companies'
    ]
    LOOP
        IF to_regclass('public.' || v_table) IS NOT NULL THEN

            EXECUTE format(
                'GRANT INSERT ON TABLE public.%I TO anon, authenticated',
                v_table
            );

            EXECUTE format(
                'GRANT SELECT ON TABLE public.%I TO authenticated',
                v_table
            );

            EXECUTE format(
                'GRANT ALL ON TABLE public.%I TO service_role',
                v_table
            );

        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 13. VERIFY TABLE EXISTENCE AND RLS STATUS
-- ============================================================================

SELECT
    t.table_name,
    CASE
        WHEN c.oid IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS table_status,
    COALESCE(c.relrowsecurity, false) AS rls_enabled
FROM (
    VALUES
        ('otp_verifications'),
        ('auth_audit_log'),
        ('client_companies'),
        ('client_users'),
        ('drivers'),
        ('vendor_companies')
) AS t(table_name)
LEFT JOIN pg_class c
    ON c.oid = to_regclass('public.' || t.table_name)
ORDER BY t.table_name;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================