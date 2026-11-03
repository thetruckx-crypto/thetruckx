-- ============================================================================
-- THE TRUCKX UNIFIED PLATFORM — PROFILE PHOTO AND USER ENHANCEMENTS
-- Adds profile photo URL and ensures canonical account mapping across roles
-- ============================================================================

DO $$
BEGIN
  -- 1. client_users: profile_photo_url and account_id
  IF to_regclass('public.client_users') IS NOT NULL THEN
    ALTER TABLE public.client_users
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS account_id TEXT;
  END IF;

  -- 2. vendor_users: profile_photo_url and account_id
  IF to_regclass('public.vendor_users') IS NOT NULL THEN
    ALTER TABLE public.vendor_users
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS account_id TEXT;
  END IF;

  -- 3. drivers: profile_photo_url and account_id
  IF to_regclass('public.drivers') IS NOT NULL THEN
    ALTER TABLE public.drivers
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS account_id TEXT;
  END IF;

  -- 4. Ensure storage bucket for avatars/photos exists and is accessible
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('avatars', 'avatars', TRUE, 10485760, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET
      public = TRUE,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
    CREATE POLICY "avatars_public_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');

    DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
    CREATE POLICY "avatars_auth_upload"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars');

    DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
    CREATE POLICY "avatars_auth_update"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars');
  END IF;
END $$;

