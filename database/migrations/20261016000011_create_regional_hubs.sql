-- ============================================================================
-- Migration: 20261016000011_create_regional_hubs.sql
-- Description: Create regional_hubs table for dynamic route coverage & regional hub selection
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.regional_hubs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'National',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing for fast search and status filtering
CREATE INDEX IF NOT EXISTS idx_regional_hubs_status ON public.regional_hubs(status);
CREATE INDEX IF NOT EXISTS idx_regional_hubs_name ON public.regional_hubs(name);
CREATE INDEX IF NOT EXISTS idx_regional_hubs_state ON public.regional_hubs(state);

-- Enable Row Level Security
ALTER TABLE public.regional_hubs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow read active regional hubs" ON public.regional_hubs;
CREATE POLICY "Allow read active regional hubs"
  ON public.regional_hubs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert custom regional hubs" ON public.regional_hubs;
CREATE POLICY "Allow insert custom regional hubs"
  ON public.regional_hubs
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update regional hubs for admin" ON public.regional_hubs;
CREATE POLICY "Allow update regional hubs for admin"
  ON public.regional_hubs
  FOR UPDATE
  USING (true);

-- Seed initial genuine active regional logistics hubs
INSERT INTO public.regional_hubs (id, name, city, state, region, status, is_custom)
VALUES
  ('hub_ghy', 'Guwahati (Gateway Hub)', 'Guwahati', 'Assam', 'North East', 'ACTIVE', false),
  ('hub_slg', 'Siliguri (North Bengal Corridor)', 'Siliguri', 'West Bengal', 'East', 'ACTIVE', false),
  ('hub_ccu', 'Kolkata (Dankuni Port Hub)', 'Kolkata', 'West Bengal', 'East', 'ACTIVE', false),
  ('hub_del', 'Delhi / NCR Logistics Hub', 'Delhi', 'Delhi', 'North', 'ACTIVE', false),
  ('hub_bom', 'Mumbai / Bhiwandi Terminal', 'Mumbai', 'Maharashtra', 'West', 'ACTIVE', false),
  ('hub_hyd', 'Hyderabad Logistics Hub', 'Hyderabad', 'Telangana', 'South', 'ACTIVE', false),
  ('hub_agt', 'Agartala (Tripura Corridor)', 'Agartala', 'Tripura', 'North East', 'ACTIVE', false),
  ('hub_dmp', 'Dimapur (Nagaland Hub)', 'Dimapur', 'Nagaland', 'North East', 'ACTIVE', false),
  ('hub_shl', 'Shillong (Meghalaya Hub)', 'Shillong', 'Meghalaya', 'North East', 'ACTIVE', false),
  ('hub_maa', 'Chennai Logistics Hub', 'Chennai', 'Tamil Nadu', 'South', 'ACTIVE', false),
  ('hub_blr', 'Bengaluru Logistics Terminal', 'Bengaluru', 'Karnataka', 'South', 'ACTIVE', false),
  ('hub_amd', 'Ahmedabad Logistics Park', 'Ahmedabad', 'Gujarat', 'West', 'ACTIVE', false),
  ('hub_pat', 'Patna Freight Hub', 'Patna', 'Bihar', 'East', 'ACTIVE', false),
  ('hub_bbs', 'Bhubaneswar Logistics Hub', 'Bhubaneswar', 'Odisha', 'East', 'ACTIVE', false),
  ('hub_rpr', 'Raipur Logistics Terminal', 'Raipur', 'Chhattisgarh', 'Central', 'ACTIVE', false),
  ('hub_jpr', 'Jaipur Transport Hub', 'Jaipur', 'Rajasthan', 'North', 'ACTIVE', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  region = EXCLUDED.region,
  status = EXCLUDED.status;
