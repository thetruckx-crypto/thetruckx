-- ============================================================================
-- NECL PRODUCTION RLS POLICIES
-- Migration: 20261012000001_production_admin_rls.sql
-- Date: 2026-10-12
--
-- PURPOSE
-- 1. Secure NECL operational tables using Row-Level Security.
-- 2. Allow only authenticated, active administrators through these policies.
-- 3. Remove existing migration-owned policies before recreating them.
-- 4. Remove known development-only policies.
-- 5. Protect audit logs against updates and deletes through these policies.
-- 6. Make the migration safe to rerun.
--
-- IMPORTANT
-- This migration does not implement Client, Vendor, or Driver policies.
-- It does not delete application data.
-- ============================================================================


-- ============================================================================
-- STEP 1: VALIDATE ADMIN TABLE
-- ============================================================================

DO $$
BEGIN

    IF to_regclass('public.admin_users') IS NULL THEN
        RAISE EXCEPTION
            'Migration aborted: public.admin_users does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_users'
          AND column_name = 'auth_uid'
    ) THEN
        RAISE EXCEPTION
            'Migration aborted: admin_users.auth_uid does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_users'
          AND column_name = 'is_active'
    ) THEN
        RAISE EXCEPTION
            'Migration aborted: admin_users.is_active does not exist.';
    END IF;

END;
$$;


-- ============================================================================
-- STEP 2: CREATE SECURE ADMIN CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$

    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users AS au
        WHERE au.auth_uid = (SELECT auth.uid())
          AND au.is_active IS TRUE
    );

$function$;


-- Restrict access to the helper function.

REVOKE ALL
ON FUNCTION public.is_active_admin()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_active_admin()
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_active_admin()
TO authenticated;


COMMENT ON FUNCTION public.is_active_admin() IS
'Checks whether the current Supabase Auth user is an active administrator.';


-- ============================================================================
-- STEP 3: CONFIGURE TABLES, CLEAN UP OLD POLICIES, AND CREATE NEW POLICIES
-- ============================================================================

DO $migration$

DECLARE

    t TEXT;
    policy_name TEXT;

    target_tables TEXT[] := ARRAY[
        'client_companies',
        'client_users',
        'vendor_companies',
        'vendor_users',
        'vehicles',
        'vendor_vehicle_links',
        'drivers',
        'requirements',
        'vendor_requests',
        'vendor_quotations',
        'client_quotes',
        'bookings',
        'trips',
        'weighments',
        'charge_lines',
        'documents',
        'payment_records',
        'chat_threads',
        'chat_messages',
        'chat_attachments',
        'audit_logs'
    ];

BEGIN

    FOREACH t IN ARRAY target_tables
    LOOP

        -- ------------------------------------------------------------
        -- 3.1 Skip tables that do not exist.
        -- ------------------------------------------------------------

        IF to_regclass(format('public.%I', t)) IS NULL THEN

            RAISE NOTICE
                'Skipping missing table: public.%', t;

            CONTINUE;

        END IF;


        -- ------------------------------------------------------------
        -- 3.2 Enable RLS.
        -- ------------------------------------------------------------

        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
            t
        );


        -- ------------------------------------------------------------
        -- 3.3 Remove known development policies.
        -- ------------------------------------------------------------

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            'necl_dev_all_' || t,
            t
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            'necl_authenticated_all_' || t,
            t
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            'necl_anon_select_' || t,
            t
        );


        -- ------------------------------------------------------------
        -- 3.4 Remove existing policies created by this migration.
        --
        -- This fixes:
        -- ERROR 42710:
        -- policy already exists
        -- ------------------------------------------------------------

        IF t = 'audit_logs' THEN

            EXECUTE
                'DROP POLICY IF EXISTS admin_read_audit_logs
                 ON public.audit_logs';

            EXECUTE
                'DROP POLICY IF EXISTS admin_insert_audit_logs
                 ON public.audit_logs';

        ELSE

            policy_name := 'admin_full_access_' || t;

            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON public.%I',
                policy_name,
                t
            );

        END IF;


        -- ------------------------------------------------------------
        -- 3.5 Create new policies.
        -- ------------------------------------------------------------

        IF t = 'audit_logs' THEN

            -- Read audit logs.

            EXECUTE $sql$
                CREATE POLICY admin_read_audit_logs
                ON public.audit_logs
                FOR SELECT
                TO authenticated
                USING (
                    public.is_active_admin()
                )
            $sql$;


            -- Insert audit logs.

            EXECUTE $sql$
                CREATE POLICY admin_insert_audit_logs
                ON public.audit_logs
                FOR INSERT
                TO authenticated
                WITH CHECK (
                    public.is_active_admin()
                )
            $sql$;


            -- No UPDATE or DELETE policy is created for audit_logs.

        ELSE

            policy_name := 'admin_full_access_' || t;

            EXECUTE format(
                'CREATE POLICY %I
                 ON public.%I
                 FOR ALL
                 TO authenticated
                 USING (
                     public.is_active_admin()
                 )
                 WITH CHECK (
                     public.is_active_admin()
                 )',
                policy_name,
                t
            );

        END IF;


        -- ------------------------------------------------------------
        -- 3.6 Remove anonymous privileges on this table.
        -- ------------------------------------------------------------

        EXECUTE format(
            'REVOKE ALL PRIVILEGES
             ON TABLE public.%I
             FROM anon',
            t
        );


        -- ------------------------------------------------------------
        -- 3.7 Grant privileges required by the policies.
        -- ------------------------------------------------------------

        IF t = 'audit_logs' THEN

            EXECUTE
                'GRANT SELECT, INSERT
                 ON TABLE public.audit_logs
                 TO authenticated';

        ELSE

            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE
                 ON TABLE public.%I
                 TO authenticated',
                t
            );

        END IF;


        -- ------------------------------------------------------------
        -- 3.8 Report success for each table.
        -- ------------------------------------------------------------

        RAISE NOTICE
            'Successfully configured RLS for public.%',
            t;

    END LOOP;

END;
$migration$;


-- ============================================================================
-- STEP 4: DOCUMENT AUDIT LOG POLICIES
-- ============================================================================

DO $$
BEGIN

    IF to_regclass('public.audit_logs') IS NOT NULL THEN

        COMMENT ON POLICY admin_read_audit_logs
        ON public.audit_logs IS
        'Only authenticated active administrators can read audit logs.';

        COMMENT ON POLICY admin_insert_audit_logs
        ON public.audit_logs IS
        'Only authenticated active administrators can insert audit logs.';

    END IF;

END;
$$;


-- ============================================================================
-- STEP 5: VERIFY RLS STATUS
-- ============================================================================

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n
    ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname = ANY (
      ARRAY[
          'client_companies',
          'client_users',
          'vendor_companies',
          'vendor_users',
          'vehicles',
          'vendor_vehicle_links',
          'drivers',
          'requirements',
          'vendor_requests',
          'vendor_quotations',
          'client_quotes',
          'bookings',
          'trips',
          'weighments',
          'charge_lines',
          'documents',
          'payment_records',
          'chat_threads',
          'chat_messages',
          'chat_attachments',
          'audit_logs'
      ]
  )
ORDER BY c.relname;


-- ============================================================================
-- STEP 6: VERIFY POLICIES
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (
      ARRAY[
          'client_companies',
          'client_users',
          'vendor_companies',
          'vendor_users',
          'vehicles',
          'vendor_vehicle_links',
          'drivers',
          'requirements',
          'vendor_requests',
          'vendor_quotations',
          'client_quotes',
          'bookings',
          'trips',
          'weighments',
          'charge_lines',
          'documents',
          'payment_records',
          'chat_threads',
          'chat_messages',
          'chat_attachments',
          'audit_logs'
      ]
  )
ORDER BY tablename, policyname;


-- ============================================================================
-- STEP 7: VERIFY ANONYMOUS TABLE PRIVILEGES
-- ============================================================================

SELECT
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND table_name = ANY (
      ARRAY[
          'client_companies',
          'client_users',
          'vendor_companies',
          'vendor_users',
          'vehicles',
          'vendor_vehicle_links',
          'drivers',
          'requirements',
          'vendor_requests',
          'vendor_quotations',
          'client_quotes',
          'bookings',
          'trips',
          'weighments',
          'charge_lines',
          'documents',
          'payment_records',
          'chat_threads',
          'chat_messages',
          'chat_attachments',
          'audit_logs'
      ]
  )
ORDER BY table_name, privilege_type;


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================