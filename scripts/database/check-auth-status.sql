-- ============================================================================
-- Check Authentication Setup Status
-- ============================================================================
-- Run this to diagnose login issues

-- 1. Check if auth users exist
SELECT 
  'Auth Users' as table_name,
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ Not Confirmed'
  END as status
FROM auth.users
WHERE email IN ('admin@necl.com', 'superadmin@necl.com')
ORDER BY email;

-- 2. Check if admin_users table exists and has records
SELECT 
  'Admin Users' as table_name,
  id,
  name,
  email,
  role,
  is_active,
  CASE 
    WHEN is_active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status
FROM admin_users
WHERE email IN ('admin@necl.com', 'superadmin@necl.com')
ORDER BY role DESC;

-- 3. Check if IDs match between auth.users and admin_users
SELECT 
  'ID Match Check' as check_type,
  au.email,
  au.id as auth_id,
  adu.id as admin_users_id,
  CASE 
    WHEN au.id::text = adu.id THEN '✅ IDs Match'
    ELSE '❌ IDs Do Not Match - FIX REQUIRED'
  END as match_status
FROM auth.users au
LEFT JOIN admin_users adu ON au.email = adu.email
WHERE au.email IN ('admin@necl.com', 'superadmin@necl.com');

-- 4. Summary
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email IN ('admin@necl.com', 'superadmin@necl.com')) as auth_users_count,
  (SELECT COUNT(*) FROM admin_users WHERE email IN ('admin@necl.com', 'superadmin@necl.com')) as admin_users_count,
  CASE 
    WHEN 
      (SELECT COUNT(*) FROM auth.users WHERE email IN ('admin@necl.com', 'superadmin@necl.com')) = 2
      AND
      (SELECT COUNT(*) FROM admin_users WHERE email IN ('admin@necl.com', 'superadmin@necl.com')) = 2
    THEN '✅ Setup Complete'
    ELSE '❌ Setup Incomplete - Follow ADMIN_LOGIN_FIX_GUIDE.md'
  END as overall_status;
