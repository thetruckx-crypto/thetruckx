-- ============================================================================
-- 1. CREATE ADMIN USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    auth_uid UUID UNIQUE NOT NULL,

    name TEXT NOT NULL,

    email TEXT NOT NULL UNIQUE,

    role TEXT NOT NULL DEFAULT 'ADMIN'
        CHECK (role IN ('ADMIN', 'SUPER_ADMIN')),

    avatar_url TEXT,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 2. ENABLE RLS
-- ============================================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Do NOT create auth_uid index separately.
-- UNIQUE already creates an index.

CREATE INDEX IF NOT EXISTS idx_admin_users_email
ON public.admin_users(email);

CREATE INDEX IF NOT EXISTS idx_admin_users_role
ON public.admin_users(role)
WHERE is_active = true;


-- ============================================================================
-- 4. CREATE SUPER ADMIN HELPER FUNCTION FIRST
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE auth_uid = auth.uid()
          AND role = 'SUPER_ADMIN'
          AND is_active = true
    );
$$;


-- ============================================================================
-- 5. DROP EXISTING POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "admin_self_read"
ON public.admin_users;

DROP POLICY IF EXISTS "admin_self_update"
ON public.admin_users;

DROP POLICY IF EXISTS "super_admin_read_all"
ON public.admin_users;

DROP POLICY IF EXISTS "super_admin_insert"
ON public.admin_users;

DROP POLICY IF EXISTS "super_admin_update_all"
ON public.admin_users;

DROP POLICY IF EXISTS "super_admin_delete"
ON public.admin_users;


-- ============================================================================
-- 6. CREATE RLS POLICIES
-- ============================================================================

-- Admin can read their own profile
CREATE POLICY "admin_self_read"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
    auth_uid = auth.uid()
);


-- Super admin can read all admin users
CREATE POLICY "super_admin_read_all"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
    public.is_super_admin()
);


-- Admin can update their own profile
CREATE POLICY "admin_self_update"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (
    auth_uid = auth.uid()
)
WITH CHECK (
    auth_uid = auth.uid()
);


-- Super admin can insert admin users
CREATE POLICY "super_admin_insert"
ON public.admin_users
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_super_admin()
);


-- Super admin can update any admin user
CREATE POLICY "super_admin_update_all"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (
    public.is_super_admin()
)
WITH CHECK (
    public.is_super_admin()
);


-- Super admin can delete admin users
CREATE POLICY "super_admin_delete"
ON public.admin_users
FOR DELETE
TO authenticated
USING (
    public.is_super_admin()
);


-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.admin_users
TO authenticated;


-- ============================================================================
-- 8. UPDATED_AT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_admin_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- 9. UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS admin_users_updated_at
ON public.admin_users;

CREATE TRIGGER admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_users_updated_at();


-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.admin_users
IS 'Admin users table linked to Supabase Auth';

COMMENT ON COLUMN public.admin_users.auth_uid
IS 'Supabase Auth user UUID from auth.users.id';

COMMENT ON COLUMN public.admin_users.role
IS 'Admin role: ADMIN or SUPER_ADMIN';

COMMENT ON COLUMN public.admin_users.is_active
IS 'Whether the admin account is active';