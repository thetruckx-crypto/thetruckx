-- ============================================================================
-- NECL PHASE 10: ELECTRONIC PROOF OF DELIVERY (e-POD), WEIGHBRIDGE CLEARANCE
-- & DAMAGE CLAIMS ARCHITECTURE
-- Migration: 20261024000024_phase10_epod_weighbridge_clearance_damage_claims.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure Table: trip_pod_submissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_pod_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_condition TEXT NOT NULL DEFAULT 'CLEAN' CHECK (delivered_condition IN ('CLEAN', 'SHORTAGE', 'DAMAGED', 'PARTIAL')),
    consignee_stamp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    pod_document_url TEXT,
    signature_url TEXT,
    remarks TEXT,
    review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_pod_submissions_trip_id ON public.trip_pod_submissions(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_pod_submissions_review_status ON public.trip_pod_submissions(review_status);

-- ----------------------------------------------------------------------------
-- 2. Ensure Table: weighments (Extended for Phase 10 Weighbridge Clearance)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weighments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('LOADING', 'UNLOADING')),
    gross_weight_mt NUMERIC(10, 2) NOT NULL,
    tare_weight_mt NUMERIC(10, 2) NOT NULL,
    net_weight_mt NUMERIC(10, 2) NOT NULL,
    slip_number TEXT,
    slip_location TEXT,
    slip_document_url TEXT,
    variance_mt NUMERIC(10, 2) DEFAULT 0,
    variance_percentage NUMERIC(6, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'MATCHED' CHECK (status IN ('MATCHED', 'TOLERANCE_ACCEPTED', 'DISCREPANCY', 'REJECTED')),
    weighbridge_name TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weighments_trip_id_stage ON public.weighments(trip_id, stage);
CREATE INDEX IF NOT EXISTS idx_weighments_status ON public.weighments(status);

-- ----------------------------------------------------------------------------
-- 3. Ensure Table: trip_claims (Consignment Damage & Shortage Claims)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_code TEXT UNIQUE NOT NULL,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    claim_type TEXT NOT NULL CHECK (claim_type IN ('DAMAGE', 'SHORTAGE', 'TRANSIT_LOSS', 'CONTAMINATION', 'PILFERAGE', 'DELAY')),
    claimed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    approved_amount NUMERIC(12, 2) DEFAULT 0,
    item_description TEXT,
    damaged_quantity NUMERIC(10, 2) DEFAULT 0,
    evidence_urls TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_INVESTIGATION', 'APPROVED', 'REJECTED', 'SETTLED')),
    settlement_notes TEXT,
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_claims_trip_id ON public.trip_claims(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_claims_status ON public.trip_claims(status);

-- ----------------------------------------------------------------------------
-- 4. Alter trips table: ensure Phase 10 control flags
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'pod_approved') THEN
        ALTER TABLE public.trips ADD COLUMN pod_approved BOOLEAN DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'pod_approved_by') THEN
        ALTER TABLE public.trips ADD COLUMN pod_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'pod_approved_at') THEN
        ALTER TABLE public.trips ADD COLUMN pod_approved_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'pod_rejection_reason') THEN
        ALTER TABLE public.trips ADD COLUMN pod_rejection_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'has_active_claims') THEN
        ALTER TABLE public.trips ADD COLUMN has_active_claims BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'has_weight_discrepancy') THEN
        ALTER TABLE public.trips ADD COLUMN has_weight_discrepancy BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Stored Procedure: rpc_submit_epod
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_submit_epod(
    p_trip_id UUID,
    p_receiver_name TEXT,
    p_receiver_phone TEXT DEFAULT NULL,
    p_delivered_condition TEXT DEFAULT 'CLEAN',
    p_consignee_stamp_verified BOOLEAN DEFAULT FALSE,
    p_pod_document_url TEXT DEFAULT NULL,
    p_signature_url TEXT DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL,
    p_submitted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip RECORD;
    v_submission_id UUID;
    v_doc_id UUID;
    v_new_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found.', 'code', 'TRIP_NOT_FOUND');
    END IF;

    -- Validate delivered condition
    IF p_delivered_condition NOT IN ('CLEAN', 'SHORTAGE', 'DAMAGED', 'PARTIAL') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid delivered condition.', 'code', 'INVALID_CONDITION');
    END IF;

    -- Insert or update submission record
    INSERT INTO public.trip_pod_submissions (
        trip_id,
        booking_id,
        receiver_name,
        receiver_phone,
        received_at,
        delivered_condition,
        consignee_stamp_verified,
        pod_document_url,
        signature_url,
        remarks,
        review_status,
        created_at,
        updated_at
    ) VALUES (
        p_trip_id,
        v_trip.booking_id,
        TRIM(p_receiver_name),
        p_receiver_phone,
        v_now,
        p_delivered_condition,
        p_consignee_stamp_verified,
        p_pod_document_url,
        p_signature_url,
        p_remarks,
        'PENDING',
        v_now,
        v_now
    ) RETURNING id INTO v_submission_id;

    -- Link into documents table
    IF p_pod_document_url IS NOT NULL THEN
        INSERT INTO public.documents (
            category,
            document_type,
            reference_id,
            file_name,
            file_url,
            storage_path,
            verification_status,
            uploaded_by,
            created_at
        ) VALUES (
            'TRIP',
            'POD',
            p_trip_id,
            'EPOD_' || v_submission_id || '.jpg',
            p_pod_document_url,
            'trips/' || p_trip_id || '/epod/' || v_submission_id || '.jpg',
            'PENDING',
            COALESCE(p_submitted_by, v_trip.driver_id),
            v_now
        ) RETURNING id INTO v_doc_id;
    END IF;

    -- If delivered condition is CLEAN and trip is AT_UNLOADING, auto-transition to DELIVERED
    v_new_status := v_trip.trip_status;
    IF v_trip.trip_status IN ('IN_TRANSIT', 'AT_UNLOADING') THEN
        v_new_status := 'DELIVERED';
        UPDATE public.trips
        SET trip_status = 'DELIVERED',
            pod_approved = NULL,
            updated_at = v_now
        WHERE id = p_trip_id;

        IF v_trip.booking_id IS NOT NULL THEN
            UPDATE public.bookings
            SET booking_status = 'DELIVERED'
            WHERE id = v_trip.booking_id;
        END IF;
    END IF;

    -- Log audit trail
    INSERT INTO public.auth_audit_log (
        user_id,
        user_type,
        event_type,
        details,
        created_at
    ) VALUES (
        COALESCE(p_submitted_by, v_trip.driver_id, '00000000-0000-0000-0000-000000000001'::UUID),
        'DRIVER',
        'EPOD_SUBMITTED',
        jsonb_build_object(
            'trip_id', p_trip_id,
            'submission_id', v_submission_id,
            'receiver_name', p_receiver_name,
            'condition', p_delivered_condition,
            'new_status', v_new_status,
            'submitted_at', v_now
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'submissionId', v_submission_id,
        'tripId', p_trip_id,
        'tripStatus', v_new_status,
        'reviewStatus', 'PENDING',
        'message', 'e-POD submitted successfully and pending admin verification.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Stored Procedure: rpc_record_weighment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_record_weighment(
    p_trip_id UUID,
    p_stage TEXT,
    p_gross_weight_mt NUMERIC,
    p_tare_weight_mt NUMERIC,
    p_slip_number TEXT DEFAULT NULL,
    p_slip_location TEXT DEFAULT NULL,
    p_slip_document_url TEXT DEFAULT NULL,
    p_weighbridge_name TEXT DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip RECORD;
    v_net_weight NUMERIC(10, 2);
    v_loading_net NUMERIC(10, 2);
    v_variance_mt NUMERIC(10, 2) := 0;
    v_variance_pct NUMERIC(6, 2) := 0;
    v_status TEXT := 'MATCHED';
    v_weighment_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_tolerance_mt NUMERIC(10, 2) := 0.20; -- Standard 0.2 MT tolerance
    v_tolerance_pct NUMERIC(6, 2) := 0.50; -- Standard 0.5% tolerance
BEGIN
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found.', 'code', 'TRIP_NOT_FOUND');
    END IF;

    IF p_stage NOT IN ('LOADING', 'UNLOADING') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid stage. Must be LOADING or UNLOADING.', 'code', 'INVALID_STAGE');
    END IF;

    IF p_gross_weight_mt <= p_tare_weight_mt THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gross weight must be strictly greater than tare weight.', 'code', 'INVALID_WEIGHTS');
    END IF;

    v_net_weight := ROUND((p_gross_weight_mt - p_tare_weight_mt)::NUMERIC, 2);

    -- If UNLOADING, compare with LOADING net weight
    IF p_stage = 'UNLOADING' THEN
        SELECT net_weight_mt INTO v_loading_net
        FROM public.weighments
        WHERE trip_id = p_trip_id AND stage = 'LOADING'
        ORDER BY recorded_at DESC
        LIMIT 1;

        IF FOUND AND v_loading_net IS NOT NULL AND v_loading_net > 0 THEN
            v_variance_mt := ROUND(ABS(v_net_weight - v_loading_net)::NUMERIC, 2);
            v_variance_pct := ROUND(((v_variance_mt / v_loading_net) * 100)::NUMERIC, 2);

            IF v_variance_mt > v_tolerance_mt AND v_variance_pct > v_tolerance_pct THEN
                v_status := 'DISCREPANCY';
                UPDATE public.trips SET has_weight_discrepancy = TRUE WHERE id = p_trip_id;
            ELSE
                v_status := 'TOLERANCE_ACCEPTED';
            END IF;
        END IF;
    END IF;

    INSERT INTO public.weighments (
        trip_id,
        stage,
        gross_weight_mt,
        tare_weight_mt,
        net_weight_mt,
        slip_number,
        slip_location,
        slip_document_url,
        variance_mt,
        variance_percentage,
        status,
        weighbridge_name,
        recorded_at,
        verified_by,
        verified_at,
        created_at
    ) VALUES (
        p_trip_id,
        p_stage,
        p_gross_weight_mt,
        p_tare_weight_mt,
        v_net_weight,
        p_slip_number,
        p_slip_location,
        p_slip_document_url,
        v_variance_mt,
        v_variance_pct,
        v_status,
        p_weighbridge_name,
        v_now,
        p_recorded_by,
        CASE WHEN v_status != 'DISCREPANCY' THEN v_now ELSE NULL END,
        v_now
    ) RETURNING id INTO v_weighment_id;

    -- Audit trail
    INSERT INTO public.auth_audit_log (
        user_id,
        user_type,
        event_type,
        details,
        created_at
    ) VALUES (
        COALESCE(p_recorded_by, '00000000-0000-0000-0000-000000000001'::UUID),
        'OPERATOR',
        CASE WHEN v_status = 'DISCREPANCY' THEN 'WEIGHBRIDGE_DISCREPANCY_FLAGGED' ELSE 'WEIGHBRIDGE_RECORDED' END,
        jsonb_build_object(
            'trip_id', p_trip_id,
            'weighment_id', v_weighment_id,
            'stage', p_stage,
            'gross_weight_mt', p_gross_weight_mt,
            'tare_weight_mt', p_tare_weight_mt,
            'net_weight_mt', v_net_weight,
            'variance_mt', v_variance_mt,
            'variance_percentage', v_variance_pct,
            'status', v_status
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'weighmentId', v_weighment_id,
        'stage', p_stage,
        'netWeightMt', v_net_weight,
        'varianceMt', v_variance_mt,
        'variancePct', v_variance_pct,
        'status', v_status,
        'hasDiscrepancy', (v_status = 'DISCREPANCY'),
        'message', CASE WHEN v_status = 'DISCREPANCY'
            THEN 'Weighbridge reading recorded. Discrepancy flagged: exceeds permissible weight tolerance.'
            ELSE 'Weighbridge reading verified within acceptable industrial tolerance.'
        END
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Stored Procedure: rpc_file_damage_claim
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_file_damage_claim(
    p_trip_id UUID,
    p_claim_type TEXT,
    p_claimed_amount NUMERIC,
    p_item_description TEXT DEFAULT NULL,
    p_damaged_quantity NUMERIC DEFAULT 0,
    p_evidence_urls TEXT[] DEFAULT '{}',
    p_submitted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip RECORD;
    v_claim_id UUID;
    v_claim_code TEXT;
    v_date_str TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
    v_rand_suffix TEXT := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found.', 'code', 'TRIP_NOT_FOUND');
    END IF;

    IF p_claim_type NOT IN ('DAMAGE', 'SHORTAGE', 'TRANSIT_LOSS', 'CONTAMINATION', 'PILFERAGE', 'DELAY') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid claim type.', 'code', 'INVALID_CLAIM_TYPE');
    END IF;

    IF p_claimed_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Claimed amount must be greater than zero.', 'code', 'INVALID_AMOUNT');
    END IF;

    v_claim_code := 'CLM-' || v_date_str || '-' || v_rand_suffix;

    INSERT INTO public.trip_claims (
        claim_code,
        trip_id,
        booking_id,
        claim_type,
        claimed_amount,
        item_description,
        damaged_quantity,
        evidence_urls,
        status,
        submitted_by,
        submitted_at,
        created_at,
        updated_at
    ) VALUES (
        v_claim_code,
        p_trip_id,
        v_trip.booking_id,
        p_claim_type,
        p_claimed_amount,
        p_item_description,
        p_damaged_quantity,
        p_evidence_urls,
        'SUBMITTED',
        p_submitted_by,
        v_now,
        v_now,
        v_now
    ) RETURNING id INTO v_claim_id;

    -- Flag trip with active claims
    UPDATE public.trips SET has_active_claims = TRUE, updated_at = v_now WHERE id = p_trip_id;

    -- Audit trail
    INSERT INTO public.auth_audit_log (
        user_id,
        user_type,
        event_type,
        details,
        created_at
    ) VALUES (
        COALESCE(p_submitted_by, '00000000-0000-0000-0000-000000000001'::UUID),
        'CLIENT',
        'DAMAGE_CLAIM_FILED',
        jsonb_build_object(
            'trip_id', p_trip_id,
            'claim_id', v_claim_id,
            'claim_code', v_claim_code,
            'claim_type', p_claim_type,
            'claimed_amount', p_claimed_amount,
            'damaged_quantity', p_damaged_quantity
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'claimId', v_claim_id,
        'claimCode', v_claim_code,
        'tripId', p_trip_id,
        'claimType', p_claim_type,
        'claimedAmount', p_claimed_amount,
        'status', 'SUBMITTED',
        'message', 'Consignment claim registered and trip flagged for commercial review.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Stored Procedure: rpc_review_epod
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_review_epod(
    p_trip_id UUID,
    p_action TEXT, -- 'APPROVE' or 'REJECT'
    p_rejection_reason TEXT DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip RECORD;
    v_has_claims BOOLEAN := FALSE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found.', 'code', 'TRIP_NOT_FOUND');
    END IF;

    IF p_action NOT IN ('APPROVE', 'REJECT') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Action must be APPROVE or REJECT.', 'code', 'INVALID_ACTION');
    END IF;

    IF p_action = 'REJECT' AND (p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required.', 'code', 'REJECTION_REASON_REQUIRED');
    END IF;

    IF p_action = 'APPROVE' THEN
        -- Check if there are active unresolved claims
        SELECT EXISTS (
            SELECT 1 FROM public.trip_claims
            WHERE trip_id = p_trip_id AND status IN ('SUBMITTED', 'UNDER_INVESTIGATION')
        ) INTO v_has_claims;

        -- Update trip pod approval
        UPDATE public.trips
        SET pod_approved = TRUE,
            pod_approved_by = p_admin_id,
            pod_approved_at = v_now,
            pod_rejection_reason = NULL,
            trip_status = CASE WHEN v_has_claims THEN 'DELIVERED' ELSE 'COMPLETED' END,
            completed_at = CASE WHEN NOT v_has_claims THEN v_now ELSE NULL END,
            updated_at = v_now
        WHERE id = p_trip_id;

        -- Update submission record
        UPDATE public.trip_pod_submissions
        SET review_status = 'APPROVED',
            reviewed_by = p_admin_id,
            reviewed_at = v_now,
            updated_at = v_now
        WHERE trip_id = p_trip_id;

        -- Mark documents verified
        UPDATE public.documents
        SET verification_status = 'VERIFIED',
            consignee_stamp_verified = TRUE,
            verified_by = p_admin_id,
            verified_at = v_now
        WHERE reference_id = p_trip_id AND document_type IN ('POD', 'POD_LR');

        -- Synchronize booking status if clean
        IF NOT v_has_claims AND v_trip.booking_id IS NOT NULL THEN
            UPDATE public.bookings SET booking_status = 'COMPLETED' WHERE id = v_trip.booking_id;
        END IF;

        -- Audit log
        INSERT INTO public.auth_audit_log (
            user_id,
            user_type,
            event_type,
            details,
            created_at
        ) VALUES (
            COALESCE(p_admin_id, '00000000-0000-0000-0000-000000000001'::UUID),
            'ADMIN',
            'EPOD_REVIEWED_APPROVED',
            jsonb_build_object(
                'trip_id', p_trip_id,
                'has_active_claims', v_has_claims,
                'final_status', CASE WHEN v_has_claims THEN 'DELIVERED' ELSE 'COMPLETED' END,
                'reviewed_at', v_now
            ),
            v_now
        );

        RETURN jsonb_build_object(
            'success', true,
            'tripId', p_trip_id,
            'podApproved', true,
            'tripStatus', CASE WHEN v_has_claims THEN 'DELIVERED' ELSE 'COMPLETED' END,
            'hasActiveClaims', v_has_claims,
            'message', CASE WHEN v_has_claims
                THEN 'e-POD approved. Trip held in DELIVERED state pending resolution of active damage claims.'
                ELSE 'e-POD approved successfully. Consignment closed and trip marked COMPLETED.'
            END
        );
    ELSE
        -- Action is REJECT
        UPDATE public.trips
        SET pod_approved = FALSE,
            pod_rejection_reason = TRIM(p_rejection_reason),
            updated_at = v_now
        WHERE id = p_trip_id;

        UPDATE public.trip_pod_submissions
        SET review_status = 'REJECTED',
            rejection_reason = TRIM(p_rejection_reason),
            reviewed_by = p_admin_id,
            reviewed_at = v_now,
            updated_at = v_now
        WHERE trip_id = p_trip_id;

        UPDATE public.documents
        SET verification_status = 'REJECTED',
            rejection_reason = TRIM(p_rejection_reason)
        WHERE reference_id = p_trip_id AND document_type IN ('POD', 'POD_LR');

        INSERT INTO public.auth_audit_log (
            user_id,
            user_type,
            event_type,
            details,
            created_at
        ) VALUES (
            COALESCE(p_admin_id, '00000000-0000-0000-0000-000000000001'::UUID),
            'ADMIN',
            'EPOD_REVIEWED_REJECTED',
            jsonb_build_object(
                'trip_id', p_trip_id,
                'rejection_reason', TRIM(p_rejection_reason),
                'reviewed_at', v_now
            ),
            v_now
        );

        RETURN jsonb_build_object(
            'success', true,
            'tripId', p_trip_id,
            'podApproved', false,
            'rejectionReason', TRIM(p_rejection_reason),
            'message', 'e-POD rejected. Driver and transporter notified for corrective re-upload.'
        );
    END IF;
END;
$$;
