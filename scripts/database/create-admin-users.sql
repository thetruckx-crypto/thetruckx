-- ============================================================================
-- Create Admin Users for NECL Fleet Management Testing
-- ============================================================================
-- Run this in your Supabase SQL Editor to create test admin users
-- These users can then log in to the admin panel

-- NOTE: You'll need to create the actual Auth users through Supabase Dashboard
-- This script only creates the admin_users records

-- ============================================================================
-- STEP 1: Create Admin Users Table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPER_ADMIN')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create RLS Policies
-- ============================================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can update own profile" ON admin_users;

-- Allow admins to read all admin users
CREATE POLICY "Admins can view all admin users"
  ON admin_users FOR SELECT
  USING (true);

-- Allow admins to update their own profile
CREATE POLICY "Admins can update own profile"
  ON admin_users FOR UPDATE
  USING (auth.uid()::text = id);

-- ============================================================================
-- STEP 3: Insert Test Admin Users
-- ============================================================================
-- Note: These IDs should match the Auth user IDs created in Supabase Auth

-- Regular Admin User
INSERT INTO admin_users (id, name, email, role, phone, is_active, two_factor_enabled)
VALUES (
  'admin-test-001',
  'Pavani (Admin)',
  'admin@necl.com',
  'ADMIN',
  '+91 98765 43210',
  true,
  false
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Super Admin User
INSERT INTO admin_users (id, name, email, role, phone, is_active, two_factor_enabled)
VALUES (
  'superadmin-test-001',
  'Pavani (Super Admin)',
  'superadmin@necl.com',
  'SUPER_ADMIN',
  '+91 98765 43211',
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  two_factor_enabled = EXCLUDED.two_factor_enabled,
  updated_at = NOW();

-- ============================================================================
-- Verification Query
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
ORDER BY created_at DESC;
