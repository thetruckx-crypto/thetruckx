-- ============================================================================
-- NECL SECURITY VERIFICATION SCRIPT
-- ============================================================================
-- Purpose:
--   Verify that security measures are properly configured.
--
-- Run this AFTER all required migrations have been deployed.
--
-- IMPORTANT:
--   Run this script in Supabase SQL Editor.
--   Some checks are informational and may behave differently depending on
--   whether you are using the SQL Editor/service role or an authenticated user.
-- ============================================================================


-- ============================================================================
-- 1. RLS (ROW LEVEL SECURITY) VERIFICATION
-- ============================================================================

-- Check RLS status for ALL public tables.

SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN 'ENABLED'
        ELSE 'DISABLED'
    END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;


-- Summary
SELECT
    COUNT(*) AS total_public_tables,
    COUNT(*) FILTER (WHERE rowsecurity) AS rls_enabled_tables,
    COUNT(*) FILTER (WHERE NOT rowsecurity) AS rls_disabled_tables,
    CASE
        WHEN COUNT(*) FILTER (WHERE NOT rowsecurity) = 0
            THEN 'PASS - RLS enabled on all public tables'
        ELSE 'FAIL - Some public tables do not have RLS enabled'
    END AS security_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%';


-- List only tables where RLS is disabled.
-- Expected: EMPTY RESULT SET

SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND NOT rowsecurity
ORDER BY tablename;


-- ============================================================================
-- 2. ANONYMOUS ACCESS VERIFICATION
-- ============================================================================

-- Check whether anon has direct table privileges on sensitive tables.
--
-- Expected:
-- EMPTY RESULT SET
--
-- NOTE:
-- This checks PostgreSQL GRANT permissions.
-- RLS policies are checked separately below.

SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name IN (
      'admin_users',
      'client_companies',
      'vendor_companies',
      'bookings',
      'trips',
      'payment_records'
  )
ORDER BY table_name, privilege_type;


-- ============================================================================
-- 3. ADMIN_USERS TABLE SECURITY
-- ============================================================================

-- Check that admin_users exists.

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'admin_users'
        )
        THEN 'PASS - admin_users table exists'
        ELSE 'FAIL - admin_users table does not exist'
    END AS admin_users_status;


-- Check admin_users RLS status.

SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN 'ENABLED'
        ELSE 'DISABLED'
    END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'admin_users';


-- Check admin_users policies.

SELECT
    policyname,
    cmd AS operation,
    roles,
    CASE
        WHEN qual IS NOT NULL
            THEN 'Has USING clause'
        ELSE 'No USING clause'
    END AS using_check,
    CASE
        WHEN with_check IS NOT NULL
            THEN 'Has WITH CHECK'
        ELSE 'No WITH CHECK'
    END AS with_check_clause,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'admin_users'
ORDER BY policyname;


-- Policy count.

SELECT
    COUNT(*) AS admin_users_policy_count,
    CASE
        WHEN COUNT(*) >= 1
            THEN 'PASS - admin_users has RLS policies'
        ELSE 'FAIL - admin_users has no RLS policies'
    END AS policy_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'admin_users';


-- ============================================================================
-- 4. PASSWORD & AUTHENTICATION SETTINGS
-- ============================================================================

-- Count Auth users.
--
-- This query requires sufficient privileges.
-- If Supabase denies access, that is a permissions limitation rather than
-- necessarily a security failure.

SELECT
    'Auth users check' AS check_name,
    COUNT(*) AS total_auth_users
FROM auth.users;


-- ============================================================================
-- 5. DANGEROUS ANONYMOUS POLICIES CHECK
-- ============================================================================

-- IMPORTANT:
-- pg_policies.roles is NAME[].
-- Therefore we use:
--
--     'anon'::name = ANY(roles)
--
-- instead of:
--
--     roles @> ARRAY['anon']
--
-- This avoids:
--     operator does not exist: name[] @> text[]
--
-- Expected: EMPTY RESULT SET

SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd AS operation,
    qual AS using_expression,
    'DANGER: Allows all anon access' AS issue
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon'::name = ANY(roles)
  AND qual = 'true';


-- ============================================================================
-- 6. CHECK ALL ANON POLICIES
-- ============================================================================

-- Display every policy assigned to anon.
-- This is informational.

SELECT
    schemaname,
    tablename,
    policyname,
    cmd AS operation,
    roles,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon'::name = ANY(roles)
ORDER BY tablename, policyname;


-- ============================================================================
-- 7. CHECK AUTHENTICATED POLICIES
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    cmd AS operation,
    roles,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND 'authenticated'::name = ANY(roles)
ORDER BY tablename, policyname;


-- ============================================================================
-- 8. DATA ISOLATION - ADMIN USERS
-- ============================================================================

-- Show the current authentication context.

SELECT
    auth.uid() AS authenticated_user_id,
    auth.role() AS current_role,
    auth.jwt() ->> 'email' AS email_from_jwt,
    auth.jwt() ->> 'role' AS role_from_jwt;


-- Check how many admin profiles are visible to the current session.
--
-- IMPORTANT:
-- Run this as an authenticated user for a meaningful RLS test.
--
-- A normal admin should normally see only their own admin profile.
-- A SUPER_ADMIN may intentionally see multiple profiles depending on policy.

SELECT
    COUNT(*) AS visible_admin_profiles,
    CASE
        WHEN auth.uid() IS NULL
            THEN 'WARNING - No authenticated user in current session'
        WHEN COUNT(*) = 1
            THEN 'PASS - One admin profile visible'
        WHEN COUNT(*) = 0
            THEN 'WARNING - No admin profile visible'
        ELSE
            'INFO - Multiple admin profiles visible; verify SUPER_ADMIN policy'
    END AS isolation_status
FROM public.admin_users;


-- ============================================================================
-- 9. VERIFY CURRENT USER ADMIN PROFILE
-- ============================================================================

SELECT
    au.id,
    au.auth_uid,
    au.name,
    au.email,
    au.role,
    au.is_active,
    CASE
        WHEN au.auth_uid = auth.uid()
            THEN 'PASS - Profile belongs to current user'
        ELSE
            'WARNING - Profile does not belong to current user'
    END AS ownership_check
FROM public.admin_users au
WHERE au.auth_uid = auth.uid();


-- ============================================================================
-- 10. is_active_admin() FUNCTION VERIFICATION
-- ============================================================================

-- First check whether the function exists.

SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_active_admin';


-- IMPORTANT:
-- Only run the following query if the function above exists with no arguments.
--
-- If the function exists as public.is_active_admin(), this returns TRUE/FALSE.
--
-- If the function does NOT exist, do not run this query.

-- SELECT
--     public.is_active_admin() AS is_active_admin;


-- ============================================================================
-- 11. CHECK is_super_admin() FUNCTION
-- ============================================================================

-- This also verifies whether the function exists.
--
-- This is particularly important because your previous migration produced:
--
-- ERROR:
-- function public.is_super_admin() does not exist

SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_super_admin';


-- ============================================================================
-- 12. CHECK IMPORTANT SECURITY FUNCTIONS
-- ============================================================================

SELECT
    function_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n
                ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = function_name
        )
        THEN 'EXISTS'
        ELSE 'MISSING'
    END AS status
FROM (
    VALUES
        ('is_active_admin'),
        ('is_super_admin')
) AS required_functions(function_name);


-- ============================================================================
-- 13. MIGRATION HISTORY
-- ============================================================================
-- Supabase projects may not expose:
--     supabase_migrations.schema_migrations
--
-- Therefore we do NOT query that relation here.
--
-- Migration history should be verified from the Supabase Dashboard
-- migration history / your migration files.
--
-- This section only verifies that the expected schema objects exist.


-- ============================================================================
-- 14. VERIFY REQUIRED TABLES
-- ============================================================================

SELECT
    required_table,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables t
            WHERE t.table_schema = 'public'
              AND t.table_name = required_table
        )
        THEN 'EXISTS'
        ELSE 'MISSING'
    END AS table_status
FROM (
    VALUES
        ('client_companies'),
        ('vendor_companies'),
        ('vehicles'),
        ('drivers'),
        ('admin_users'),
        ('bookings'),
        ('trips'),
        ('payment_records')
) AS tables(required_table)
ORDER BY required_table;

-- ============================================================================
-- 15. REQUIRED TABLES EXISTENCE CHECK
-- ============================================================================

SELECT
    required_table,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables t
            WHERE t.table_schema = 'public'
              AND t.table_name = required_table
        )
        THEN 'EXISTS'
        ELSE 'MISSING'
    END AS table_status
FROM (
    VALUES
        ('client_companies'),
        ('vendor_companies'),
        ('vehicles'),
        ('drivers'),
        ('admin_users'),
        ('bookings'),
        ('trips'),
        ('payment_records')
) AS tables(required_table)
ORDER BY required_table;


-- ============================================================================
-- 16. TABLE COUNTS - SANITY CHECK
-- ============================================================================

-- These are informational counts.
--
-- NOTE:
-- If RLS is enabled, the count depends on the permissions of the current
-- database session.

SELECT
    'client_companies' AS table_name,
    COUNT(*) AS record_count
FROM public.client_companies

UNION ALL

SELECT
    'vendor_companies',
    COUNT(*)
FROM public.vendor_companies

UNION ALL

SELECT
    'vehicles',
    COUNT(*)
FROM public.vehicles

UNION ALL

SELECT
    'drivers',
    COUNT(*)
FROM public.drivers

UNION ALL

SELECT
    'admin_users',
    COUNT(*)
FROM public.admin_users

UNION ALL

SELECT
    'bookings',
    COUNT(*)
FROM public.bookings

UNION ALL

SELECT
    'trips',
    COUNT(*)
FROM public.trips;


-- ============================================================================
-- 17. ADMIN_USERS RECORD CHECK
-- ============================================================================

SELECT
    COUNT(*) AS total_admin_users,
    COUNT(*) FILTER (WHERE is_active = TRUE) AS active_admin_users,
    COUNT(*) FILTER (WHERE role = 'ADMIN') AS admin_users,
    COUNT(*) FILTER (WHERE role = 'SUPER_ADMIN') AS super_admin_users
FROM public.admin_users;


-- ============================================================================
-- 18. CHECK ADMIN ROLE VALUES
-- ============================================================================

SELECT
    role,
    COUNT(*) AS user_count
FROM public.admin_users
GROUP BY role
ORDER BY role;


-- ============================================================================
-- 19. CHECK INACTIVE ADMIN USERS
-- ============================================================================

SELECT
    id,
    auth_uid,
    name,
    email,
    role,
    is_active
FROM public.admin_users
WHERE is_active = FALSE
ORDER BY name;


-- ============================================================================
-- 20. SESSION & AUTH CONFIGURATION
-- ============================================================================

SELECT
    auth.uid() AS authenticated_user_id,
    auth.role() AS current_role,
    auth.jwt() ->> 'email' AS email_from_jwt,
    auth.jwt() ->> 'role' AS role_from_jwt,
    CASE
        WHEN auth.uid() IS NULL
            THEN 'WARNING - No authenticated session'
        ELSE
            'PASS - Authenticated session detected'
    END AS session_status;


-- ============================================================================
-- 21. CHECK PUBLIC POLICIES THAT USE anon
-- ============================================================================

SELECT
    tablename,
    policyname,
    cmd AS operation,
    roles,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon'::name = ANY(roles)
ORDER BY tablename, policyname;


-- ============================================================================
-- 22. CHECK POLICIES USING TRUE
-- ============================================================================

-- Find policies that effectively allow everyone.
--
-- Expected for sensitive tables:
-- EMPTY RESULT SET

SELECT
    schemaname,
    tablename,
    policyname,
    cmd AS operation,
    roles,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND (
      qual = 'true'
      OR with_check = 'true'
  )
ORDER BY tablename, policyname;


-- ============================================================================
-- 23. CHECK SENSITIVE TABLES FOR ANON POLICIES
-- ============================================================================

SELECT
    tablename,
    policyname,
    cmd AS operation,
    roles,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'admin_users',
      'client_companies',
      'vendor_companies',
      'bookings',
      'trips',
      'payment_records'
  )
  AND 'anon'::name = ANY(roles)
ORDER BY tablename, policyname;


-- ============================================================================
-- 24. CHECK SECURITY-DEFINER FUNCTIONS
-- ============================================================================

-- Security-definer functions need careful review.

SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    CASE
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END AS security_mode
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;


-- ============================================================================
-- 25. CHECK FOR DEVELOPMENT POLICIES
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    cmd AS operation,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND (
      policyname ILIKE '%dev%'
      OR policyname ILIKE '%test%'
      OR policyname ILIKE '%necl_anon%'
  )
ORDER BY tablename, policyname;


-- ============================================================================
-- 26. GENERATE CLEANUP STATEMENTS FOR DEVELOPMENT POLICIES
-- ============================================================================

-- This DOES NOT delete anything.
--
-- It only generates DROP POLICY statements for manual review.

SELECT
    'DROP POLICY IF EXISTS '
    || quote_ident(policyname)
    || ' ON public.'
    || quote_ident(tablename)
    || ';' AS cleanup_statement
FROM pg_policies
WHERE schemaname = 'public'
  AND (
      policyname ILIKE '%dev%'
      OR policyname ILIKE '%test%'
      OR policyname ILIKE '%necl_anon%'
  )
ORDER BY tablename, policyname;


-- ============================================================================
-- 27. CHECK GRANTS FOR PUBLIC ROLE
-- ============================================================================

-- Check whether PUBLIC has direct table privileges on sensitive tables.

SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'PUBLIC'
  AND table_schema = 'public'
  AND table_name IN (
      'admin_users',
      'client_companies',
      'vendor_companies',
      'bookings',
      'trips',
      'payment_records'
  )
ORDER BY table_name, privilege_type;


-- ============================================================================
-- 28. FINAL SECURITY SUMMARY
-- ============================================================================

WITH rls_check AS (
    SELECT
        COUNT(*) AS total_tables,
        COUNT(*) FILTER (WHERE rowsecurity) AS enabled_tables,
        COUNT(*) FILTER (WHERE NOT rowsecurity) AS disabled_tables
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
),
admin_check AS (
    SELECT
        COUNT(*) AS admin_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
),
dangerous_anon AS (
    SELECT
        COUNT(*) AS dangerous_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'anon'::name = ANY(roles)
      AND qual = 'true'
)
SELECT
    r.total_tables,
    r.enabled_tables,
    r.disabled_tables,
    a.admin_policy_count,
    d.dangerous_policy_count,

    CASE
        WHEN r.disabled_tables = 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS rls_check,

    CASE
        WHEN a.admin_policy_count > 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS admin_policy_check,

    CASE
        WHEN d.dangerous_policy_count = 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS anon_policy_check,

    CASE
        WHEN r.disabled_tables = 0
         AND a.admin_policy_count > 0
         AND d.dangerous_policy_count = 0
            THEN 'SECURITY BASELINE PASSED'
        ELSE
            'SECURITY REVIEW REQUIRED'
    END AS overall_security_status

FROM rls_check r
CROSS JOIN admin_check a
CROSS JOIN dangerous_anon d;


-- ============================================================================
-- SECURITY CHECKLIST
-- ============================================================================
/*

Review the results above.

[ ] RLS enabled on all required public tables
[ ] No unexpected public tables without RLS
[ ] anon has no direct privileges on sensitive tables
[ ] admin_users table exists
[ ] admin_users has RLS enabled
[ ] admin_users has appropriate policies
[ ] No dangerous anon policy using USING (true)
[ ] No dangerous sensitive-table anon policies
[ ] Auth users can be inspected by authorized session
[ ] Current authenticated session has auth.uid()
[ ] Current authenticated user has an admin_users record
[ ] is_active_admin() function exists
[ ] is_super_admin() function exists
[ ] Required migrations are applied
[ ] Required tables exist
[ ] Admin user count is correct
[ ] Active admin users are correct
[ ] No unexpected development/test policies remain
[ ] Security-definer functions have been reviewed
[ ] No unexpected PUBLIC grants on sensitive tables

IMPORTANT:

1. Do NOT treat table COUNT(*) from the SQL Editor as an RLS test.
2. RLS must be tested using an actual authenticated user session.
3. SUPER_ADMIN intentionally may have broader access than ADMIN.
4. An empty result from the anon-policy checks is expected for sensitive tables.
5. Do not expose service_role keys, database passwords, or Supabase secrets
   in frontend code.
6. Never put SUPABASE_SERVICE_ROLE_KEY in React/React Native client code.

============================================================================
*/