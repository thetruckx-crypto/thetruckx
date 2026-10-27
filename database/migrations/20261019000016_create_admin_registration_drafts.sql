-- ============================================================================
-- Migration: 20261019000016_create_admin_registration_drafts.sql
-- Description: Creates admin_registration_drafts table for saving and resuming
--              incomplete Client and Vendor registration workflows in Admin Panel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_registration_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('CLIENT', 'VENDOR')),
  title TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED')),
  step_progress INT NOT NULL DEFAULT 1,
  completion_percentage INT NOT NULL DEFAULT 0,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  vehicle_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  operating_lanes JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT DEFAULT 'admin@necl.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast retrieval and ordering
CREATE INDEX IF NOT EXISTS idx_admin_registration_drafts_entity
  ON public.admin_registration_drafts (entity_type, status);

CREATE INDEX IF NOT EXISTS idx_admin_registration_drafts_updated
  ON public.admin_registration_drafts (updated_at DESC);

-- Enable RLS
ALTER TABLE public.admin_registration_drafts ENABLE ROW LEVEL SECURITY;

-- Production Admin RLS Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_registration_drafts'
      AND policyname = 'Admins have full access to registration drafts'
  ) THEN
    CREATE POLICY "Admins have full access to registration drafts"
      ON public.admin_registration_drafts
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
