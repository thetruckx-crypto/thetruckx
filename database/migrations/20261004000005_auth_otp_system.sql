-- ============================================================================
-- NECL Multi-Role Authentication & OTP System
-- Corrected, rerunnable Supabase migration
-- No demo/sample users are inserted.
-- IMPORTANT: Run in Supabase SQL Editor as database owner/postgres.
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Compatibility: extend existing core tables only when they exist.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
    ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];
    ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS remember_token TEXT;
    ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS remember_token_expires_at TIMESTAMPTZ;
  END IF;

  IF to_regclass('public.vendors') IS NOT NULL THEN
    ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. OTP verifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT,
  country_code TEXT DEFAULT '+91',
  otp_code TEXT,
  purpose TEXT DEFAULT 'LOGIN',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_expired BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB
);

ALTER TABLE public.otp_verifications
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS otp_code TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'LOGIN',
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS device_info JSONB;

-- If an older schema stored this value as "phone", copy it safely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='otp_verifications' AND column_name='phone') THEN
    EXECUTE 'UPDATE public.otp_verifications SET phone_number = phone::text WHERE phone_number IS NULL AND phone IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='otp_verifications' AND column_name='otp') THEN
    EXECUTE 'UPDATE public.otp_verifications SET otp_code = otp::text WHERE otp_code IS NULL AND otp IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON public.otp_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON public.otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON public.otp_verifications(is_verified);
CREATE INDEX IF NOT EXISTS idx_otp_created_at ON public.otp_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON public.otp_verifications(phone_number, purpose, is_verified);

-- ---------------------------------------------------------------------------
-- 2. Drivers table. Existing columns are preserved; missing ones are added.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  license_expiry_date DATE,
  aadhar_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  verification_status TEXT DEFAULT 'PENDING',
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  profile_photo_url TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS license_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS aadhar_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='drivers' AND column_name='phone_number') THEN
    EXECUTE 'UPDATE public.drivers SET phone = phone_number::text WHERE phone IS NULL AND phone_number IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='drivers' AND column_name='full_name') THEN
    EXECUTE 'UPDATE public.drivers SET name = full_name::text WHERE name IS NULL AND full_name IS NOT NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.drivers'::regclass AND conname='drivers_verification_status_check') THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_verification_status_check
      CHECK (verification_status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON public.drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_verification_status ON public.drivers(verification_status);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON public.drivers(license_number);

-- ---------------------------------------------------------------------------
-- 3. Authentication sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.auth_sessions
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT,
  ADD COLUMN IF NOT EXISTS session_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS device_info JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.auth_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.auth_sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.auth_sessions(is_active, expires_at);

-- ---------------------------------------------------------------------------
-- 4. OTP rate limits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.otp_rate_limits
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS request_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='otp_rate_limits' AND column_name='phone') THEN
    EXECUTE 'UPDATE public.otp_rate_limits SET phone_number = phone::text WHERE phone_number IS NULL AND phone IS NOT NULL';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_rate_limit_phone ON public.otp_rate_limits(phone_number);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.otp_rate_limits(window_start);

-- ---------------------------------------------------------------------------
-- 5. Authentication audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  user_type TEXT,
  event_type TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.auth_audit_log
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.auth_audit_log(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_audit_event ON public.auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.auth_audit_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Timestamp triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.necl_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_otp_timestamp ON public.otp_verifications;
CREATE TRIGGER trigger_update_otp_timestamp BEFORE UPDATE ON public.otp_verifications
FOR EACH ROW EXECUTE FUNCTION public.necl_set_updated_at();
DROP TRIGGER IF EXISTS trigger_update_session_timestamp ON public.auth_sessions;
CREATE TRIGGER trigger_update_session_timestamp BEFORE UPDATE ON public.auth_sessions
FOR EACH ROW EXECUTE FUNCTION public.necl_set_updated_at();
DROP TRIGGER IF EXISTS trigger_update_driver_timestamp ON public.drivers;
CREATE TRIGGER trigger_update_driver_timestamp BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.necl_set_updated_at();
DROP TRIGGER IF EXISTS trigger_update_rate_limit_timestamp ON public.otp_rate_limits;
CREATE TRIGGER trigger_update_rate_limit_timestamp BEFORE UPDATE ON public.otp_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.necl_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.otp_verifications
     SET is_expired = TRUE
   WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_expired = FALSE;
END;
$$;

-- Atomic rate-limit counter, preventing concurrent requests from bypassing it.
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(
  p_phone_number TEXT,
  p_max_requests INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.otp_rate_limits%ROWTYPE;
BEGIN
  IF p_phone_number IS NULL OR btrim(p_phone_number) = '' OR p_max_requests < 1 OR p_window_minutes < 1 THEN
    RETURN FALSE;
  END IF;

  -- A unique key is needed for one counter per phone. Create it if possible.
  PERFORM pg_advisory_xact_lock(hashtext(p_phone_number));
  SELECT * INTO v_row FROM public.otp_rate_limits
   WHERE phone_number = p_phone_number
   ORDER BY window_start DESC, created_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND AND v_row.blocked_until IS NOT NULL AND v_row.blocked_until > NOW() THEN
    RETURN FALSE;
  END IF;

  IF NOT FOUND OR v_row.window_start <= NOW() - make_interval(mins => p_window_minutes) THEN
    INSERT INTO public.otp_rate_limits(phone_number, request_count, window_start, blocked_until)
    VALUES (p_phone_number, 1, NOW(), NULL);
    RETURN TRUE;
  END IF;

  IF v_row.request_count >= p_max_requests THEN
    UPDATE public.otp_rate_limits SET blocked_until = NOW() + INTERVAL '1 hour', updated_at = NOW()
     WHERE id = v_row.id;
    RETURN FALSE;
  END IF;

  UPDATE public.otp_rate_limits SET request_count = request_count + 1, updated_at = NOW()
   WHERE id = v_row.id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_otp(
  p_phone_number TEXT,
  p_purpose TEXT DEFAULT 'LOGIN'
)
RETURNS TABLE(id UUID, otp_code TEXT, attempts INTEGER, max_attempts INTEGER, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT ov.id, ov.otp_code, ov.attempts, ov.max_attempts, ov.expires_at
    FROM public.otp_verifications AS ov
   WHERE ov.phone_number = p_phone_number
     AND ov.purpose = p_purpose
     AND ov.is_verified = FALSE
     AND ov.is_expired = FALSE
     AND ov.expires_at > NOW()
     AND ov.attempts < ov.max_attempts
   ORDER BY ov.created_at DESC
   LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_account_approval(p_user_id TEXT, p_user_type TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF upper(p_user_type) = 'VENDOR' THEN
    IF to_regclass('public.vendors') IS NULL THEN
      RETURN jsonb_build_object('approved', FALSE, 'status', 'TABLE_MISSING', 'message', 'vendors table does not exist');
    END IF;
    EXECUTE 'SELECT verification_status::text FROM public.vendors WHERE id::text = $1 LIMIT 1'
      INTO v_status USING p_user_id;
  ELSIF upper(p_user_type) = 'DRIVER' THEN
    SELECT verification_status INTO v_status FROM public.drivers WHERE id::text = p_user_id LIMIT 1;
  ELSIF upper(p_user_type) IN ('ADMIN','SUPER_ADMIN') THEN
    IF to_regclass('public.admin_users') IS NULL THEN
      RETURN jsonb_build_object('approved', FALSE, 'status', 'TABLE_MISSING', 'message', 'admin_users table does not exist');
    END IF;
    EXECUTE 'SELECT CASE WHEN is_active THEN ''APPROVED'' ELSE ''SUSPENDED'' END FROM public.admin_users WHERE id::text = $1 LIMIT 1'
      INTO v_status USING p_user_id;
  ELSE
    RETURN jsonb_build_object('approved', FALSE, 'status', 'UNKNOWN', 'message', 'Invalid user type');
  END IF;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('approved', FALSE, 'status', 'NOT_FOUND', 'message', 'User not found or status is NULL');
  ELSIF upper(v_status) = 'APPROVED' THEN
    RETURN jsonb_build_object('approved', TRUE, 'status', v_status);
  ELSE
    RETURN jsonb_build_object('approved', FALSE, 'status', v_status, 'message', 'Account is not approved');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- Restrict sensitive OTP/session/rate-limit/audit writes to service_role.
-- Supabase service_role normally bypasses RLS; explicit policies are scoped.
-- ---------------------------------------------------------------------------
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage OTP verifications" ON public.otp_verifications;
CREATE POLICY "Service role can manage OTP verifications" ON public.otp_verifications
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view own sessions" ON public.auth_sessions;
CREATE POLICY "Users can view own sessions" ON public.auth_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR user_id = (auth.jwt() ->> 'user_id'));
DROP POLICY IF EXISTS "Service role can manage all sessions" ON public.auth_sessions;
CREATE POLICY "Service role can manage all sessions" ON public.auth_sessions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.otp_rate_limits;
CREATE POLICY "Service role can manage rate limits" ON public.otp_rate_limits
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Admins can view audit log" ON public.auth_audit_log;
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    CREATE POLICY "Admins can view audit log" ON public.auth_audit_log
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.admin_users au
                 WHERE au.id::text = auth.uid()::text AND au.is_active = TRUE)
      );
  END IF;
END $$;
DROP POLICY IF EXISTS "Service role can manage audit log" ON public.auth_audit_log;
CREATE POLICY "Service role can manage audit log" ON public.auth_audit_log
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Drivers can view own profile" ON public.drivers;
CREATE POLICY "Drivers can view own profile" ON public.drivers
  FOR SELECT TO authenticated USING (id::text = auth.uid()::text);
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    CREATE POLICY "Admins can view all drivers" ON public.drivers
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id::text = auth.uid()::text AND au.is_active = TRUE)
      );
    CREATE POLICY "Admins can manage drivers" ON public.drivers
      FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id::text = auth.uid()::text AND au.is_active = TRUE)
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id::text = auth.uid()::text AND au.is_active = TRUE)
      );
  END IF;
END $$;

-- Functions that expose OTP values should not be callable by public clients.
REVOKE ALL ON FUNCTION public.get_active_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_otp_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_account_approval(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otps() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_account_approval(TEXT, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Table comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.otp_verifications IS 'OTP verification records; access through trusted backend/service role only.';
COMMENT ON TABLE public.auth_sessions IS 'Application authentication session records.';
COMMENT ON TABLE public.otp_rate_limits IS 'OTP request rate-limit counters.';
COMMENT ON TABLE public.auth_audit_log IS 'Audit trail for authentication events.';
COMMENT ON TABLE public.drivers IS 'Driver profiles and verification status.';

COMMIT;

-- ---------------------------------------------------------------------------
-- 10. Verification query (run separately after migration if desired)
-- ---------------------------------------------------------------------------
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('otp_verifications','otp_rate_limits','drivers')
-- ORDER BY table_name, ordinal_position;
