-- ============================================================================
-- NECL Admin Users Setup Script
-- ============================================================================
-- Purpose: Create initial admin users after Supabase Auth accounts are created
-- 
-- PREREQUISITES:
-- 1. You must first create users in Supabase Auth Dashboard:
--    - Go to Authentication → Users → Add user
--    - Create admin@necl.com and superadmin@necl.com
-- 2. Note down the auth.users.id (UUID) for each user
-- 3. Replace the UUIDs below with the actual values
-- ============================================================================

-- Step 1: Verify auth users exist
SELECT 
  id as auth_user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email IN ('admin@necl.com', 'superadmin@necl.com')
ORDER BY email;

-- Expected output: 2 rows with both users


-- Step 2: Create admin_users records
-- IMPORTANT: Replace these UUIDs with actual values from Step 1
INSERT INTO public.admin_users (auth_uid, name, email, role, is_active)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',  -- ⚠️ REPLACE with actual admin@necl.com auth.users.id
    'Pavani (Admin)',
    'admin@necl.com',
    'ADMIN',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',  -- ⚠️ REPLACE with actual superadmin@necl.com auth.users.id
    'Pavani (Super Admin)',
    'superadmin@necl.com',
    'SUPER_ADMIN',
    true
  )
ON CONFLICT (auth_uid) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = now();


-- Step 3: Verify admin_users records
SELECT 
  au.id as admin_user_id,
  au.auth_uid,
  au.name,
  au.email,
  au.role,
  au.is_active,
  u.email_confirmed_at as auth_email_confirmed
FROM public.admin_users au
JOIN auth.users u ON u.id = au.auth_uid
ORDER BY au.role DESC, au.email;

-- Expected output: 2 rows showing both admin users with confirmed auth


-- Step 4: Test RLS policies
-- This should return results (authenticated as admin)
SELECT 
  'Admin can read own profile' as test_name,
  COUNT(*) as records
FROM public.admin_users 
WHERE auth_uid = auth.uid();

-- This should return all records (if user is super admin)
SELECT 
  'Super admin can read all profiles' as test_name,
  COUNT(*) as records
FROM public.admin_users;


-- Step 5: Grant necessary permissions (already done in migration, but verify)
SELECT 
  grantee,
  privilege_type,
  table_name
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'admin_users'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;


-- ============================================================================
-- Optional: Create additional admin users
-- ============================================================================

-- Template for creating more admins:
/*
-- 1. Create user in Supabase Auth Dashboard first
-- 2. Get the auth.users.id
-- 3. Run this query with actual values:

INSERT INTO public.admin_users (auth_uid, name, email, role, is_active)
VALUES 
  (
    'AUTH_UID_HERE',
    'Full Name',
    'email@necl.com',
    'ADMIN',  -- or 'SUPER_ADMIN'
    true
  );
*/


-- ============================================================================
-- Troubleshooting Queries
-- ============================================================================

-- Check if RLS is enabled on admin_users
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'admin_users';

-- List all policies on admin_users
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'admin_users';

-- Check current authenticated user
SELECT 
  auth.uid() as current_auth_uid,
  auth.role() as current_role;

-- Find admin_users record for current authenticated user
SELECT * 
FROM public.admin_users 
WHERE auth_uid = auth.uid();
