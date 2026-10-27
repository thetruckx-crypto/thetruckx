-- ============================================================================
-- Migration: 20261024000018_phase4_client_requirements_and_rfq_workflow.sql
-- Description: Phase 4 Requirements & RFQ Lifecycle:
--              1. Adds correction_notes, reviewed_by, reviewed_at to requirements.
--              2. Adds decline_reason, declined_at, accepted_at to vendor_requests.
--              3. Creates unique index on vendor_requests (requirement_id, vendor_id)
--                 to strictly prevent duplicate RFQ assignments.
--              4. Adds composite index on vendor_requests (vendor_id, status) and
--                 (requirement_id, deadline_at) for efficient vendor filtering.
-- ============================================================================

DO $$
BEGIN

  -- 1. Extend requirements table with review and correction fields
  IF to_regclass('public.requirements') IS NOT NULL THEN
    ALTER TABLE public.requirements
      ADD COLUMN IF NOT EXISTS correction_notes TEXT,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  END IF;

  -- 2. Extend vendor_requests table with participation and decline fields
  IF to_regclass('public.vendor_requests') IS NOT NULL THEN
    ALTER TABLE public.vendor_requests
      ADD COLUMN IF NOT EXISTS decline_reason TEXT,
      ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

    -- 3. Composite unique index preventing duplicate RFQs per vendor & requirement
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_requests_unique_req_vendor
      ON public.vendor_requests (requirement_id, vendor_id);

    -- 4. Composite index for vendor RFQ filtering
    CREATE INDEX IF NOT EXISTS idx_vendor_requests_vendor_status
      ON public.vendor_requests (vendor_id, status);

    -- 5. Index for response deadline tracking
    CREATE INDEX IF NOT EXISTS idx_vendor_requests_deadline
      ON public.vendor_requests (requirement_id, deadline_at);
  END IF;

END $$;
