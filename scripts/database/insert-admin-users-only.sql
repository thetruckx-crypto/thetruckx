-- ============================================================================
-- SIMPLE: Just Insert Admin Users (No Table Creation or Policies)
-- ============================================================================
-- Use this if admin_users table already exists
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Get your Auth User IDs first
-- ============================================================================
-- Run this query to see existing Auth users:
-- SELECT id, email, email_confirmed_at FROM auth.users;

-- ============================================================================
-- STEP 2: Insert Admin Users
-- ============================================================================
-- Replace the IDs below with actual Auth user UUIDs from Step 1

-- Admin User
INSERT INTO admin_users (id, name, email, role, phone, is_active, two_factor_enabled)
VALUES (
  '00000000-0000-0000-0000-000000000001',  -- REPLACE THIS with actual Auth user UUID
  'Pavani (Admin)',
  'admin@necl.com',
  'ADMIN',
  '+91 98765 43210',
  true,
  false
)
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Super Admin User
INSERT INTO admin_users (id, name, email, role, phone, is_active, two_factor_enabled)
VALUES (
  '00000000-0000-0000-0000-000000000002',  -- REPLACE THIS with actual Auth user UUID
  'Pavani (Super Admin)',
  'superadmin@necl.com',
  'SUPER_ADMIN',
  '+91 98765 43211',
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  two_factor_enabled = EXCLUDED.two_factor_enabled,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: Verify the insertion
-- ============================================================================
SELECT 
  id,
  name,
  email,
  role,
  is_active,
  two_factor_enabled,
  created_at
FROM admin_users
ORDER BY role DESC;
