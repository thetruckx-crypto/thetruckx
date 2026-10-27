-- ============================================================================
-- Quick Admin User Creation Script for NECL
-- ============================================================================
-- Run this in Supabase SQL Editor to quickly set up admin users
-- This assumes you've already created Auth users via Dashboard

-- ============================================================================
-- OPTION A: If you have Auth User UIDs (recommended)
-- ============================================================================
-- First, get your Auth user UIDs by running this in SQL Editor:
-- SELECT id, email FROM auth.users WHERE email IN ('admin@necl.com', 'superadmin@necl.com');
-- Then replace the IDs below with actual Auth user UIDs

-- INSERT INTO admin_users (id, name, email, role, phone, is_active, two_factor_enabled)
-- VALUES 
--   ('REPLACE_WITH_ADMIN_AUTH_UID', 'Pavani (Admin)', 'admin@necl.com', 'ADMIN', '+91 98765 43210', true, false),
--   ('REPLACE_WITH_SUPERADMIN_AUTH_UID', 'Pavani (Super Admin)', 'superadmin@necl.com', 'SUPER_ADMIN', '+91 98765 43211', true, true)
-- ON CONFLICT (email) DO UPDATE SET
--   id = EXCLUDED.id,
--   name = EXCLUDED.name,
--   role = EXCLUDED.role,
--   updated_at = NOW();

-- ============================================================================
-- OPTION B: Create with dummy IDs (for testing without Auth)
-- ============================================================================
-- NOTE: This won't work for actual login since Auth users must exist
-- But useful for testing database structure

INSERT INTO admin_users (id, name, email, role, phone, is_active, two_factor_enabled)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Pavani (Admin)', 'admin@necl.com', 'ADMIN', '+91 98765 43210', true, false),
  ('00000000-0000-0000-0000-000000000002', 'Pavani (Super Admin)', 'superadmin@necl.com', 'SUPER_ADMIN', '+91 98765 43211', true, true)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  two_factor_enabled = EXCLUDED.two_factor_enabled,
  updated_at = NOW();

-- ============================================================================
-- Verify the insertion
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

-- ============================================================================
-- Check if Auth users exist (optional)
-- ============================================================================
-- This might require service role key
-- SELECT id, email, email_confirmed_at, created_at
-- FROM auth.users
-- WHERE email IN ('admin@necl.com', 'superadmin@necl.com');
