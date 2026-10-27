-- ============================================================================
-- NECL PHASE 11: COMMERCIAL INVOICING, TRANSPORTER PAYMENT SLIPS,
-- TDS & GST SETTLEMENT ENGINE
-- Migration: 20261024000025_phase11_commercial_invoicing_transporter_settlement_tds.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table: client_invoices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES public.client_companies(id),
    base_amount NUMERIC(12, 2) NOT NULL,
    loading_detention_charges NUMERIC(10, 2) DEFAULT 0,
    unloading_detention_charges NUMERIC(10, 2) DEFAULT 0,
    platform_fee NUMERIC(10, 2) DEFAULT 0,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    gst_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    is_interstate BOOLEAN NOT NULL DEFAULT FALSE,
    cgst_amount NUMERIC(10, 2) DEFAULT 0,
    sgst_amount NUMERIC(10, 2) DEFAULT 0,
    igst_amount NUMERIC(10, 2) DEFAULT 0,
    total_tax NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(12, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PAYMENT_PENDING' CHECK (payment_status IN ('PAYMENT_PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
    due_date DATE NOT NULL,
    credit_terms TEXT DEFAULT 'NET_30',
    invoice_url TEXT,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_invoices_booking_id ON public.client_invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id ON public.client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_payment_status ON public.client_invoices(payment_status);

-- ----------------------------------------------------------------------------
-- 2. Table: transporter_payouts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transporter_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_number TEXT UNIQUE NOT NULL,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES public.vendor_companies(id),
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    agreed_vendor_rate NUMERIC(12, 2) NOT NULL,
    tds_section TEXT NOT NULL DEFAULT '194C',
    tds_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    tds_deducted_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    advance_paid_amount NUMERIC(10, 2) DEFAULT 0,
    claim_deduction_amount NUMERIC(10, 2) DEFAULT 0,
    other_deductions NUMERIC(10, 2) DEFAULT 0,
    net_payable_amount NUMERIC(12, 2) NOT NULL,
    amount_disbursed NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payout_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payout_status IN ('PENDING', 'PROCESSING', 'DISBURSED', 'ON_HOLD')),
    disbursal_date TIMESTAMPTZ,
    bank_reference_utr TEXT,
    payment_method TEXT DEFAULT 'NEFT',
    payout_slip_url TEXT,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    disbursed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transporter_payouts_trip_id ON public.transporter_payouts(trip_id);
CREATE INDEX IF NOT EXISTS idx_transporter_payouts_vendor_id ON public.transporter_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_transporter_payouts_status ON public.transporter_payouts(payout_status);

-- ----------------------------------------------------------------------------
-- 3. Stored Procedure: rpc_generate_client_invoice
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_generate_client_invoice(
    p_booking_id TEXT,
    p_loading_detention NUMERIC DEFAULT 0,
    p_unloading_detention NUMERIC DEFAULT 0,
    p_platform_fee NUMERIC DEFAULT 0,
    p_credit_days INT DEFAULT 30,
    p_generated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
    v_trip RECORD;
    v_req RECORD;
    v_client RECORD;
    v_existing_inv RECORD;
    v_inv_id UUID;
    v_inv_num TEXT;
    v_date_str TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
    v_rand_suffix TEXT := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    v_base NUMERIC(12, 2);
    v_taxable NUMERIC(12, 2);
    v_is_interstate BOOLEAN := FALSE;
    v_gst_rate NUMERIC(5, 2) := 18.00;
    v_cgst NUMERIC(10, 2) := 0;
    v_sgst NUMERIC(10, 2) := 0;
    v_igst NUMERIC(10, 2) := 0;
    v_total_tax NUMERIC(12, 2) := 0;
    v_grand_total NUMERIC(12, 2) := 0;
    v_due_date DATE := CURRENT_DATE + COALESCE(p_credit_days, 30);
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Idempotency check: return existing invoice if present
    SELECT * INTO v_existing_inv FROM public.client_invoices WHERE booking_id = p_booking_id LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'isIdempotent', true,
            'invoiceId', v_existing_inv.id,
            'invoiceNumber', v_existing_inv.invoice_number,
            'totalAmount', v_existing_inv.total_amount,
            'balanceDue', v_existing_inv.balance_due,
            'message', 'Invoice already exists for this booking (idempotent retrieval).'
        );
    END IF;

    -- Fetch Booking
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not found.', 'code', 'BOOKING_NOT_FOUND');
    END IF;

    -- Fetch Trip if exists
    SELECT * INTO v_trip FROM public.trips WHERE booking_id = p_booking_id LIMIT 1;

    -- Fetch Requirement & Client
    SELECT * INTO v_req FROM public.requirements WHERE id = v_booking.requirement_id;
    SELECT * INTO v_client FROM public.client_companies WHERE id = v_booking.client_id;

    -- Calculate Taxable Amount
    v_base := COALESCE(v_booking.grand_total, 50000);
    -- If booking has accepted quote with breakdown, extract base
    v_taxable := v_base + COALESCE(p_loading_detention, 0) + COALESCE(p_unloading_detention, 0) + COALESCE(p_platform_fee, 0);

    -- Interstate determination (Assam code 18 vs client state)
    IF v_client.gstin IS NOT NULL AND SUBSTRING(v_client.gstin, 1, 2) != '18' THEN
        v_is_interstate := TRUE;
    ELSIF v_client.state IS NOT NULL AND LOWER(TRIM(v_client.state)) NOT IN ('assam', 'as') THEN
        v_is_interstate := TRUE;
    END IF;

    -- Calculate GST
    IF v_is_interstate THEN
        v_igst := ROUND((v_taxable * (v_gst_rate / 100.0))::NUMERIC, 2);
        v_total_tax := v_igst;
    ELSE
        v_cgst := ROUND((v_taxable * ((v_gst_rate / 2.0) / 100.0))::NUMERIC, 2);
        v_sgst := v_cgst;
        v_total_tax := v_cgst + v_sgst;
    END IF;

    v_grand_total := v_taxable + v_total_tax;
    v_inv_num := 'INV-' || v_date_str || '-' || v_rand_suffix;

    INSERT INTO public.client_invoices (
        invoice_number,
        booking_id,
        trip_id,
        client_id,
        base_amount,
        loading_detention_charges,
        unloading_detention_charges,
        platform_fee,
        taxable_amount,
        gst_rate_percent,
        is_interstate,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_tax,
        total_amount,
        amount_paid,
        balance_due,
        payment_status,
        due_date,
        credit_terms,
        invoice_url,
        generated_by,
        created_at,
        updated_at
    ) VALUES (
        v_inv_num,
        p_booking_id,
        v_trip.id,
        v_booking.client_id,
        v_base,
        COALESCE(p_loading_detention, 0),
        COALESCE(p_unloading_detention, 0),
        COALESCE(p_platform_fee, 0),
        v_taxable,
        v_gst_rate,
        v_is_interstate,
        v_cgst,
        v_sgst,
        v_igst,
        v_total_tax,
        v_grand_total,
        0,
        v_grand_total,
        'PAYMENT_PENDING',
        v_due_date,
        'NET_' || COALESCE(p_credit_days, 30),
        '/documents/invoices/' || v_inv_num || '.pdf',
        p_generated_by,
        v_now,
        v_now
    ) RETURNING id INTO v_inv_id;

    -- Persist document record
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
        'FINANCIAL',
        'CLIENT_INVOICE',
        v_inv_id,
        v_inv_num || '.pdf',
        '/documents/invoices/' || v_inv_num || '.pdf',
        'invoices/' || v_inv_num || '.pdf',
        'VERIFIED',
        p_generated_by,
        v_now
    );

    -- Audit trail
    INSERT INTO public.auth_audit_log (
        user_id,
        user_type,
        event_type,
        details,
        created_at
    ) VALUES (
        COALESCE(p_generated_by, '00000000-0000-0000-0000-000000000001'::UUID),
        'ADMIN',
        'CLIENT_INVOICE_GENERATED',
        jsonb_build_object(
            'invoice_id', v_inv_id,
            'invoice_number', v_inv_num,
            'booking_id', p_booking_id,
            'taxable_amount', v_taxable,
            'total_tax', v_total_tax,
            'total_amount', v_grand_total,
            'is_interstate', v_is_interstate
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'isIdempotent', false,
        'invoiceId', v_inv_id,
        'invoiceNumber', v_inv_num,
        'taxableAmount', v_taxable,
        'totalTax', v_total_tax,
        'totalAmount', v_grand_total,
        'balanceDue', v_grand_total,
        'isInterstate', v_is_interstate,
        'dueDate', v_due_date,
        'message', 'Client tax invoice generated successfully.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Stored Procedure: rpc_generate_transporter_payout
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_generate_transporter_payout(
    p_trip_id UUID,
    p_advance_paid NUMERIC DEFAULT 0,
    p_claim_deduction NUMERIC DEFAULT 0,
    p_other_deductions NUMERIC DEFAULT 0,
    p_generated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip RECORD;
    v_vendor RECORD;
    v_existing_payout RECORD;
    v_payout_id UUID;
    v_payout_num TEXT;
    v_date_str TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
    v_rand_suffix TEXT := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    v_vendor_rate NUMERIC(12, 2);
    v_tds_rate NUMERIC(5, 2) := 1.00;
    v_tds_deducted NUMERIC(10, 2) := 0;
    v_net_payable NUMERIC(12, 2) := 0;
    v_pan TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Idempotency check: return existing payout if present
    SELECT * INTO v_existing_payout FROM public.transporter_payouts WHERE trip_id = p_trip_id LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'isIdempotent', true,
            'payoutId', v_existing_payout.id,
            'payoutNumber', v_existing_payout.payout_number,
            'netPayableAmount', v_existing_payout.net_payable_amount,
            'payoutStatus', v_existing_payout.payout_status,
            'message', 'Payout slip already exists for this trip (idempotent retrieval).'
        );
    END IF;

    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found.', 'code', 'TRIP_NOT_FOUND');
    END IF;

    SELECT * INTO v_vendor FROM public.vendor_companies WHERE id = v_trip.vendor_id;
    v_vendor_rate := COALESCE(v_trip.vendor_rate, 40000);

    -- TDS Section 194C Logic:
    -- 4th character of PAN: 'P' = Individual (1%), 'C' / 'F' = Company/Firm (2%), No PAN = 20%
    v_pan := UPPER(TRIM(COALESCE(v_vendor.pan, '')));
    IF LENGTH(v_pan) != 10 THEN
        v_tds_rate := 20.00; -- Penal TDS under Section 206AA
    ELSIF SUBSTRING(v_pan, 4, 1) = 'P' THEN
        v_tds_rate := 1.00;  -- Individual / HUF
    ELSE
        v_tds_rate := 2.00;  -- Corporate / Partnership Firm
    END IF;

    v_tds_deducted := ROUND((v_vendor_rate * (v_tds_rate / 100.0))::NUMERIC, 2);
    v_net_payable := v_vendor_rate - v_tds_deducted - COALESCE(p_advance_paid, 0) - COALESCE(p_claim_deduction, 0) - COALESCE(p_other_deductions, 0);

    IF v_net_payable < 0 THEN
        v_net_payable := 0;
    END IF;

    v_payout_num := 'PAY-' || v_date_str || '-' || v_rand_suffix;

    INSERT INTO public.transporter_payouts (
        payout_number,
        trip_id,
        booking_id,
        vendor_id,
        driver_id,
        agreed_vendor_rate,
        tds_section,
        tds_rate_percent,
        tds_deducted_amount,
        advance_paid_amount,
        claim_deduction_amount,
        other_deductions,
        net_payable_amount,
        amount_disbursed,
        payout_status,
        payment_method,
        payout_slip_url,
        generated_by,
        created_at,
        updated_at
    ) VALUES (
        v_payout_num,
        p_trip_id,
        v_trip.booking_id,
        v_trip.vendor_id,
        v_trip.driver_id,
        v_vendor_rate,
        '194C',
        v_tds_rate,
        v_tds_deducted,
        COALESCE(p_advance_paid, 0),
        COALESCE(p_claim_deduction, 0),
        COALESCE(p_other_deductions, 0),
        v_net_payable,
        0,
        'PENDING',
        'NEFT',
        '/documents/payouts/' || v_payout_num || '.pdf',
        p_generated_by,
        v_now,
        v_now
    ) RETURNING id INTO v_payout_id;

    -- Persist document record
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
        'FINANCIAL',
        'PAYMENT_RECEIPT',
        v_payout_id,
        v_payout_num || '.pdf',
        '/documents/payouts/' || v_payout_num || '.pdf',
        'payouts/' || v_payout_num || '.pdf',
        'VERIFIED',
        p_generated_by,
        v_now
    );

    -- Audit trail
    INSERT INTO public.auth_audit_log (
        user_id,
        user_type,
        event_type,
        details,
        created_at
    ) VALUES (
        COALESCE(p_generated_by, '00000000-0000-0000-0000-000000000001'::UUID),
        'ADMIN',
        'TRANSPORTER_PAYOUT_GENERATED',
        jsonb_build_object(
            'payout_id', v_payout_id,
            'payout_number', v_payout_num,
            'trip_id', p_trip_id,
            'vendor_rate', v_vendor_rate,
            'tds_rate', v_tds_rate,
            'tds_deducted', v_tds_deducted,
            'advance_paid', p_advance_paid,
            'claim_deduction', p_claim_deduction,
            'net_payable', v_net_payable
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'isIdempotent', false,
        'payoutId', v_payout_id,
        'payoutNumber', v_payout_num,
        'vendorRate', v_vendor_rate,
        'tdsRate', v_tds_rate,
        'tdsDeducted', v_tds_deducted,
        'advancePaid', p_advance_paid,
        'claimDeduction', p_claim_deduction,
        'netPayableAmount', v_net_payable,
        'payoutStatus', 'PENDING',
        'message', 'Transporter payout slip generated with Section 194C TDS calculation.'
    );
END;
$$;
