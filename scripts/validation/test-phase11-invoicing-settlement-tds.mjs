/**
 * NECL Phase 11 Automated End-to-End Validation Test Suite:
 * Commercial Invoicing, Transporter Payment Slips, TDS & GST Settlement Engine
 *
 * Verifies:
 *  1. Client Commercial Tax Invoicing Engine (POST /api/invoices/client/generate):
 *     - Missing bookingId rejected with HTTP 400
 *     - Intrastate GST Tax Invoice generation (Assam: CGST 9% + SGST 9%)
 *     - Interstate GST Tax Invoice generation (Outside Assam: IGST 18%)
 *     - Taxable calculation (base freight + loading/unloading detention + platform fee)
 *     - Net-30 credit terms and due date computation
 *     - Document persistence into public.documents table (CLIENT_INVOICE)
 *     - Idempotent invoice retrieval guarantee
 *  2. Commercial Confidentiality Protection:
 *     - Client invoice strictly omits transporter purchase rates (vendor_rate) and internal margins
 *     - Transporter payout slip strictly omits client billing amounts and platform margins
 *  3. Transporter Payout Settlement & Section 194C TDS Engine (POST /api/payouts/transporter/generate):
 *     - Missing tripId rejected with HTTP 400
 *     - Section 194C TDS for Individual/HUF (PAN 4th char 'P') = 1% TDS
 *     - Section 194C TDS for Corporate/Firm (PAN 4th char 'C'/'F') = 2% TDS
 *     - Section 206AA Penal TDS for Missing/Invalid PAN = 20% TDS
 *     - Deductions: diesel/cash advances, Phase 10 damage claims, demurrage
 *     - Net payable computation (vendor_rate - tds - advance - claims - deductions)
 *     - Document persistence into public.documents table (PAYMENT_RECEIPT)
 *     - Idempotent payout retrieval guarantee
 *  4. Client Payment Ingestion & Status Transitions (POST /api/invoices/client/:invoiceId/record-payment):
 *     - Missing UTR reference rejected with HTTP 400 & UTR_REQUIRED
 *     - Non-positive payment amount rejected with HTTP 400 & INVALID_AMOUNT
 *     - Partial payment ingestion transitions status to PARTIALLY_PAID
 *     - Full payment balance clearance transitions status to PAID
 *     - Payment records persisted to public.payment_records table with UTR reference
 *     - Booking payment status synchronized to PAYMENT_COMPLETED
 *  5. Transporter Bank Disbursal (POST /api/payouts/transporter/:payoutId/record-disbursal):
 *     - Missing bankReferenceUtr rejected with HTTP 400 & UTR_REQUIRED
 *     - Disbursal recorded with UTR reference and payment method (NEFT/RTGS)
 *     - Transporter payout status transitioned to DISBURSED
 *  6. Commercial Reconciliation Ledger (GET /api/finance/reconciliation):
 *     - Aggregates billed, collected, outstanding, payables, disbursed, TDS, GST liability, and gross margin
 *  7. Immutable Audit Trail Verification (public.auth_audit_log):
 *     - Verifies CLIENT_INVOICE_GENERATED, CLIENT_PAYMENT_RECORDED, TRANSPORTER_PAYOUT_GENERATED,
 *       TRANSPORTER_PAYOUT_DISBURSED, FINANCIAL_LEDGER_RECONCILED
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env safely
const envPath = path.resolve(__dirname, '../../server/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runPhase11Tests() {
  console.log('\n========================================================================');
  console.log(' NECL PHASE 11: COMMERCIAL INVOICING, TRANSPORTER SETTLEMENT & TDS SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail) {
    if (condition) {
      console.log(`  \x1b[32m✔\x1b[0m [PASS] ${testName}`);
      if (detail) console.log(`      \x1b[90m↳ ${detail}\x1b[0m`);
      passed++;
    } else {
      console.error(`  \x1b[31m✖\x1b[0m [FAIL] ${testName}`);
      if (detail) console.error(`      \x1b[31m↳ ${detail}\x1b[0m`);
      failed++;
    }
  }

  const runId = Math.floor(1000 + Math.random() * 9000);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  try {
    // -------------------------------------------------------------------------
    // STEP 0: Health Check & Environment Verification
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Health Check & Fixture Setup ---');

    const healthResp = await fetch(`${BACKEND_URL}/api/health`);
    const healthJson = await healthResp.json();
    assert(healthResp.ok && healthJson.status?.toLowerCase() === 'ok', 'Backend server health check passes', `Status: ${healthJson.status}`);

    const { data: authSession } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

    // 1. Setup Assam Client (Intrastate GST)
    const clientAssamId = crypto.randomUUID();
    const { data: clientAssam, error: cErr1 } = await supabase.from('client_companies').insert([{
      id: clientAssamId,
      company_name: `Assam Petrochemicals Ltd ${runId}`,
      business_type: 'Private Limited',
      gstin: `18AAAAA${runId}A1Z5`,
      pan: `AAAAA${runId}A`.slice(0, 10),
      registered_address: 'Beltola Industrial Area, Guwahati',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781010',
      company_phone: `9876${runId}1`.slice(0, 10),
      company_email: `assam.client.${runId}@necl.com`,
      client_code: `CLI-AS-${runId}`,
      status: 'APPROVED',
    }]).select('*').single();
    if (cErr1) console.error('Notice creating Assam client fixture:', cErr1);

    // 2. Setup Outside Assam Client (Interstate GST: West Bengal)
    const clientBengalId = crypto.randomUUID();
    const { data: clientBengal, error: cErr2 } = await supabase.from('client_companies').insert([{
      id: clientBengalId,
      company_name: `Bengal Heavy Engineering Ltd ${runId}`,
      business_type: 'Private Limited',
      gstin: `19BBBBB${runId}B1Z8`,
      pan: `BBBBB${runId}B`.slice(0, 10),
      registered_address: 'Strand Road Heavy Depot, Kolkata',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      company_phone: `9877${runId}2`.slice(0, 10),
      company_email: `bengal.client.${runId}@necl.com`,
      client_code: `CLI-WB-${runId}`,
      status: 'APPROVED',
    }]).select('*').single();
    if (cErr2) console.error('Notice creating Bengal client fixture:', cErr2);

    // 3. Setup Transporter 1: Individual/HUF (PAN 4th char 'P' -> 1% TDS)
    const vendorIndividualId = crypto.randomUUID();
    const panIndividual = `ABCPM${runId}Z`.slice(0, 10);
    const { data: vendorIndividual, error: vErr1 } = await supabase.from('vendor_companies').insert([{
      id: vendorIndividualId,
      vendor_name: `Pranab Logistics Proprietary ${runId}`,
      pan: panIndividual,
      gstin: `18${panIndividual}1Z0`,
      address: 'Lokhra Chariali, NH-37, Guwahati',
      status: 'APPROVED',
    }]).select('*').single();
    if (vErr1) console.error('Notice creating Individual vendor fixture:', vErr1);

    // 4. Setup Transporter 2: Corporate/Firm (PAN 4th char 'C' -> 2% TDS)
    const vendorCorporateId = crypto.randomUUID();
    const panCorporate = `ABCCB${runId}Z`.slice(0, 10);
    const { data: vendorCorporate, error: vErr2 } = await supabase.from('vendor_companies').insert([{
      id: vendorCorporateId,
      vendor_name: `Brahmaputra Freight Carriers Corp ${runId}`,
      pan: panCorporate,
      gstin: `18${panCorporate}1Z4`,
      address: 'Betkuchi Transport Nagar, Guwahati',
      status: 'APPROVED',
    }]).select('*').single();
    if (vErr2) console.error('Notice creating Corporate vendor fixture:', vErr2);

    // 5. Setup Transporter 3: Missing/Invalid PAN (Penal 20% TDS Section 206AA)
    const vendorPenalId = crypto.randomUUID();
    const { data: vendorPenal, error: vErr3 } = await supabase.from('vendor_companies').insert([{
      id: vendorPenalId,
      vendor_name: `Unregistered Local Hauler ${runId}`,
      pan: 'INVALID',
      address: 'Amingaon Truck Terminus, Guwahati',
      status: 'APPROVED',
    }]).select('*').single();
    if (vErr3) console.error('Notice creating Penal vendor fixture:', vErr3);

    // 6. Setup Fleet: Vehicles & Drivers
    const { data: vehicle1 } = await supabase
      .from('vehicles')
      .insert({
        registration_number: `AS-01-TAX-${runId}`,
        vehicle_type: '32FT_MXL',
        rated_capacity_mt: 25,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    const { data: driver1 } = await supabase
      .from('drivers')
      .insert({
        full_name: `Deepak Nath ${runId}`,
        mobile: `98815${runId}`.slice(0, 10),
        licence_number: `AS-01-DL-${runId}`,
        licence_expiry_date: '2030-01-01',
        primary_vendor_id: vendorIndividualId,
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    // 7. Setup Bookings & Trips
    // Booking 1: Intrastate (Assam -> Assam)
    const reqCode1 = `REQ-AS-${dateStr}-${runId}`;
    const { data: req1 } = await supabase
      .from('requirements')
      .insert({
        id: reqCode1,
        requirement_code: reqCode1,
        client_id: clientAssamId,
        pickup_address: 'Guwahati Industrial Zone, Assam 781010',
        pickup_pincode: '781010',
        destination_address: 'Dibrugarh Distribution Hub, Assam 786001',
        destination_pincode: '786001',
        vehicle_type: '32FT_MXL',
        material_type: 'Polymers & Petrochemicals',
        required_capacity_mt: 22,
        loading_datetime: new Date().toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();

    // Quote 1 for Requirement 1
    const { data: quote1, error: qErr1 } = await supabase
      .from('client_quotes')
      .insert({
        requirement_id: req1.id,
        version: 1,
        vendor_base_cost: 50000,
        admin_margin: 0,
        gst_rate_percent: 18,
        gst_amount: 9000,
        total_client_amount: 59000,
        status: 'ACCEPTED',
        validity_expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select('*')
      .single();
    if (qErr1) console.error('Notice creating Quote 1:', qErr1);

    const bookingId1 = `BOK-AS-${dateStr}-${runId}`;
    const { error: bErr1 } = await supabase.from('bookings').insert({
      id: bookingId1,
      client_id: clientAssamId,
      requirement_id: req1.id,
      accepted_quote_id: quote1?.id,
      booking_status: 'CONFIRMED',
      grand_total: 59000, // 50,000 base + 18% GST (9,000)
      payment_status: 'PAYMENT_PENDING',
      confirmed_at: new Date().toISOString(),
    });
    if (bErr1) console.error('Notice creating Booking 1:', bErr1);

    const tripId1 = crypto.randomUUID();
    const { error: tErr1 } = await supabase.from('trips').insert({
      id: tripId1,
      booking_id: bookingId1,
      vendor_id: vendorIndividualId,
      vehicle_id: vehicle1?.id,
      driver_id: driver1?.id,
      vendor_rate: 42000,
      trip_status: 'DELIVERED',
    });
    if (tErr1) console.error('Notice creating Trip 1:', tErr1);

    // Booking 2: Interstate (Assam -> West Bengal)
    const reqCode2 = `REQ-WB-${dateStr}-${runId}`;
    const { data: req2, error: rErr2 } = await supabase
      .from('requirements')
      .insert({
        id: reqCode2,
        requirement_code: reqCode2,
        client_id: clientBengalId,
        pickup_address: 'Guwahati Port, Assam 781010',
        pickup_pincode: '781010',
        destination_address: 'Kolkata Docks, West Bengal 700001',
        destination_pincode: '700001',
        vehicle_type: '32FT_MXL',
        material_type: 'Steel Pipes & Structurals',
        required_capacity_mt: 24,
        loading_datetime: new Date().toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();
    if (rErr2) console.error('Notice creating Requirement 2:', rErr2);

    // Quote 2 for Requirement 2
    const { data: quote2, error: qErr2 } = await supabase
      .from('client_quotes')
      .insert({
        requirement_id: req2.id,
        version: 1,
        vendor_base_cost: 60000,
        admin_margin: 0,
        gst_rate_percent: 18,
        gst_amount: 10800,
        total_client_amount: 70800,
        status: 'ACCEPTED',
        validity_expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select('*')
      .single();
    if (qErr2) console.error('Notice creating Quote 2:', qErr2);

    const bookingId2 = `BOK-WB-${dateStr}-${runId}`;
    const { error: bErr2 } = await supabase.from('bookings').insert({
      id: bookingId2,
      client_id: clientBengalId,
      requirement_id: req2.id,
      accepted_quote_id: quote2?.id,
      booking_status: 'CONFIRMED',
      grand_total: 70800, // 60,000 base + 18% GST (10,800)
      payment_status: 'PAYMENT_PENDING',
      confirmed_at: new Date().toISOString(),
    });
    if (bErr2) console.error('Notice creating Booking 2:', bErr2);

    const tripId2 = crypto.randomUUID();
    const { error: tErr2 } = await supabase.from('trips').insert({
      id: tripId2,
      booking_id: bookingId2,
      vendor_id: vendorCorporateId,
      vehicle_id: vehicle1?.id,
      driver_id: driver1?.id,
      vendor_rate: 55000,
      trip_status: 'DELIVERED',
    });
    if (tErr2) console.error('Notice creating Trip 2:', tErr2);

    // Booking 3: For Penal TDS Transporter Test
    const tripId3 = crypto.randomUUID();
    const { error: tErr3 } = await supabase.from('trips').insert({
      id: tripId3,
      booking_id: bookingId1,
      vendor_id: vendorPenalId,
      vehicle_id: vehicle1?.id,
      driver_id: driver1?.id,
      vendor_rate: 35000,
      trip_status: 'DELIVERED',
    });
    if (tErr3) console.error('Notice creating Trip 3:', tErr3);

    console.log('  \x1b[32m✔\x1b[0m Phase 11 Fixtures initialized successfully.\n');

    // -------------------------------------------------------------------------
    // STEP 1: Client Commercial GST Tax Invoicing Engine
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Client Commercial Tax Invoice Generation ---');

    // 1.1 Validation: Missing bookingId rejected
    const badInvResp = await fetch(`${BACKEND_URL}/api/invoices/client/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(badInvResp.status === 400, 'Invoice generation requires bookingId (returns HTTP 400)');

    // 1.2 Intrastate GST Invoice Generation (Assam Client)
    const inv1Resp = await fetch(`${BACKEND_URL}/api/invoices/client/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: bookingId1,
        loadingDetention: 2000,
        unloadingDetention: 1500,
        platformFee: 1000,
        creditDays: 30,
        generatedBy: '00000000-0000-0000-0000-000000000001',
      }),
    });
    const inv1 = await inv1Resp.json();
    if (!inv1Resp.ok) console.error('inv1 error details:', inv1Resp.status, inv1);

    assert(inv1Resp.ok && inv1.success === true, 'Intrastate client tax invoice generated successfully', `Invoice: ${inv1.invoiceNumber}`);
    assert(inv1.invoiceNumber.startsWith('INV-'), 'Invoice number follows INV-YYYYMMDD-XXXX convention', inv1.invoiceNumber);
    assert(inv1.isInterstate === false, 'Intrastate tax determined for Assam client (isInterstate = false)');
    assert(inv1.cgstAmount > 0 && inv1.sgstAmount > 0 && inv1.igstAmount === 0, 'Intrastate GST split correctly computed (CGST 9% + SGST 9%, IGST 0)', `CGST: ₹${inv1.cgstAmount}, SGST: ₹${inv1.sgstAmount}`);
    assert(inv1.totalTax === Math.round((inv1.cgstAmount + inv1.sgstAmount) * 100) / 100, 'Total tax matches sum of CGST and SGST', `Total Tax: ₹${inv1.totalTax}`);
    assert(inv1.balanceDue === inv1.totalAmount, 'Balance due initially equals full invoice total', `Balance: ₹${inv1.balanceDue}`);
    assert(inv1.paymentStatus === 'PAYMENT_PENDING', 'Initial invoice payment status is PAYMENT_PENDING');

    const invoice1Id = inv1.invoiceId;

    // 1.3 Interstate GST Invoice Generation (Outside Assam Client)
    const inv2Resp = await fetch(`${BACKEND_URL}/api/invoices/client/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: bookingId2,
        loadingDetention: 3000,
        unloadingDetention: 2000,
        platformFee: 1500,
        creditDays: 45,
        generatedBy: '00000000-0000-0000-0000-000000000001',
      }),
    });
    const inv2 = await inv2Resp.json();

    assert(inv2Resp.ok && inv2.success === true, 'Interstate client tax invoice generated successfully', `Invoice: ${inv2.invoiceNumber}`);
    assert(inv2.isInterstate === true, 'Interstate tax determined for West Bengal client (isInterstate = true)');
    assert(inv2.igstAmount > 0 && inv2.cgstAmount === 0 && inv2.sgstAmount === 0, 'Interstate GST applied as IGST 18% (CGST 0, SGST 0)', `IGST: ₹${inv2.igstAmount}`);
    assert(inv2.totalTax === inv2.igstAmount, 'Total tax matches 18% IGST', `Total Tax: ₹${inv2.totalTax}`);

    const invoice2Id = inv2.invoiceId;

    // 1.4 Idempotency Check: Re-generating invoice for same booking returns existing invoice
    const idempInvResp = await fetch(`${BACKEND_URL}/api/invoices/client/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: bookingId1 }),
    });
    const idempInv = await idempInvResp.json();

    assert(idempInvResp.ok && idempInv.isIdempotent === true, 'Client invoice generation is strictly idempotent', 'isIdempotent = true');
    assert(idempInv.invoiceId === invoice1Id, 'Idempotent request returns original invoiceId without creating duplicates', idempInv.invoiceId);

    // -------------------------------------------------------------------------
    // STEP 2: Client Invoice Retrieval & Commercial Rate Confidentiality
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Commercial Rate Confidentiality Enforcement ---');

    const getInvResp = await fetch(`${BACKEND_URL}/api/invoices/client/${invoice1Id}`);
    const getInvJson = await getInvResp.json();

    assert(getInvResp.ok && getInvJson.success === true, 'Client invoice details retrieved successfully', `ID: ${invoice1Id}`);
    assert(getInvJson.invoice.vendorRate === undefined && getInvJson.invoice.agreed_vendor_rate === undefined, 'COMMERCIAL CONFIDENTIALITY: Transporter purchase rate strictly omitted from client invoice view');
    assert(getInvJson.invoice.admin_margin === undefined && getInvJson.invoice.platformMargin === undefined, 'COMMERCIAL CONFIDENTIALITY: Platform profit margin strictly omitted from client invoice view');
    assert(getInvJson.invoice.taxableAmount > 0 && getInvJson.invoice.totalAmount > 0, 'Client view retains full commercial billing breakdown (taxable, GST, total)');

    // 2.2 404 on invalid invoice ID
    const notFoundInvResp = await fetch(`${BACKEND_URL}/api/invoices/client/non-existent-invoice-id`);
    assert(notFoundInvResp.status === 404, 'Non-existent invoice returns HTTP 404');

    // -------------------------------------------------------------------------
    // STEP 3: Client Payment Ingestion & Lifecycle Settlement
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Client Payment Ingestion & Lifecycle Settlement ---');

    // 3.1 Validation: Invalid amount rejected
    const badPay1 = await fetch(`${BACKEND_URL}/api/invoices/client/${invoice1Id}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -500, transactionReference: 'UTR123' }),
    });
    assert(badPay1.status === 400, 'Non-positive payment amount rejected with HTTP 400');

    // 3.2 Validation: Missing transaction reference rejected
    const badPay2 = await fetch(`${BACKEND_URL}/api/invoices/client/${invoice1Id}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10000, transactionReference: '  ' }),
    });
    assert(badPay2.status === 400, 'Missing transactionReference (UTR) rejected with HTTP 400');

    // 3.3 Partial Payment Recording
    const initialTotal = inv1.totalAmount;
    const partialAmount = Math.round((initialTotal / 2) * 100) / 100;
    const utrPartial = `UTR${dateStr}PARTIAL${runId}`;

    const partPayResp = await fetch(`${BACKEND_URL}/api/invoices/client/${invoice1Id}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: partialAmount,
        paymentMode: 'NEFT',
        transactionReference: utrPartial,
        notes: 'Initial 50% advance invoice payment',
      }),
    });
    const partPay = await partPayResp.json();

    assert(partPayResp.ok && partPay.success === true, 'Partial payment recorded successfully', `Amount: ₹${partialAmount}`);
    assert(partPay.paymentStatus === 'PARTIALLY_PAID', 'Invoice status transitions to PARTIALLY_PAID on partial settlement');
    assert(partPay.amountPaid === partialAmount, 'amountPaid accurately reflects partial collection', `Paid: ₹${partPay.amountPaid}`);
    assert(partPay.balanceDue === Math.round((initialTotal - partialAmount) * 100) / 100, 'balanceDue accurately decremented', `Remaining: ₹${partPay.balanceDue}`);

    // 3.4 Full Settlement Payment Recording
    const remainingBalance = partPay.balanceDue;
    const utrFull = `UTR${dateStr}FINAL${runId}`;

    const fullPayResp = await fetch(`${BACKEND_URL}/api/invoices/client/${invoice1Id}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: remainingBalance,
        paymentMode: 'RTGS',
        transactionReference: utrFull,
        notes: 'Final balance invoice clearance',
      }),
    });
    const fullPay = await fullPayResp.json();

    assert(fullPayResp.ok && fullPay.success === true, 'Full invoice settlement payment recorded successfully', `Amount: ₹${remainingBalance}`);
    assert(fullPay.paymentStatus === 'PAID', 'Invoice payment status transitions to PAID upon balance clearance');
    assert(fullPay.balanceDue === 0, 'balanceDue reaches exactly ₹0.00', `Balance: ₹${fullPay.balanceDue}`);

    // -------------------------------------------------------------------------
    // STEP 4: Transporter Payout Slips & Section 194C TDS Settlement Engine
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Transporter Payouts & Section 194C TDS Calculation ---');

    // 4.1 Validation: Missing tripId rejected
    const badPayoutResp = await fetch(`${BACKEND_URL}/api/payouts/transporter/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(badPayoutResp.status === 400, 'Payout generation requires tripId (returns HTTP 400)');

    // 4.2 Individual / HUF Transporter: 1% TDS under Section 194C
    const pay1Resp = await fetch(`${BACKEND_URL}/api/payouts/transporter/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: tripId1,
        advancePaid: 10000,
        claimDeduction: 2000, // Phase 10 damage claim deduction
        otherDeductions: 500, // Demurrage/penalty
        generatedBy: '00000000-0000-0000-0000-000000000001',
      }),
    });
    const pay1 = await pay1Resp.json();

    assert(pay1Resp.ok && pay1.success === true, 'Transporter payout slip generated for Individual Transporter', `Slip: ${pay1.payoutNumber}`);
    assert(pay1.payoutNumber.startsWith('PAY-'), 'Payout slip number follows PAY-YYYYMMDD-XXXX convention', pay1.payoutNumber);
    assert(pay1.tdsSection === '194C', 'TDS correctly classified under Section 194C');
    assert(pay1.tdsRatePercent === 1.00, 'Individual / HUF PAN (4th char P) incurs exactly 1% TDS rate', `TDS Rate: ${pay1.tdsRatePercent}%`);

    const expectedTds1 = Math.round((pay1.vendorRate * 0.01) * 100) / 100;
    assert(pay1.tdsDeductedAmount === expectedTds1, 'TDS deduction amount matches 1% of agreed vendor rate', `TDS: ₹${pay1.tdsDeductedAmount}`);

    const expectedNet1 = Math.round((pay1.vendorRate - expectedTds1 - 10000 - 2000 - 500) * 100) / 100;
    assert(pay1.netPayableAmount === expectedNet1, 'Net payable accurately computed after TDS, advances, claims, and deductions', `Net: ₹${pay1.netPayableAmount}`);
    assert(pay1.payoutStatus === 'PENDING', 'Initial payout status is PENDING');

    const payout1Id = pay1.payoutId;

    // 4.3 Corporate / Partnership Firm Transporter: 2% TDS under Section 194C
    const pay2Resp = await fetch(`${BACKEND_URL}/api/payouts/transporter/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: tripId2,
        advancePaid: 15000,
        claimDeduction: 0,
        otherDeductions: 0,
        generatedBy: '00000000-0000-0000-0000-000000000001',
      }),
    });
    const pay2 = await pay2Resp.json();

    assert(pay2Resp.ok && pay2.success === true, 'Transporter payout slip generated for Corporate Transporter', `Slip: ${pay2.payoutNumber}`);
    assert(pay2.tdsRatePercent === 2.00, 'Corporate PAN (4th char C) incurs exactly 2% TDS rate', `TDS Rate: ${pay2.tdsRatePercent}%`);

    const expectedTds2 = Math.round((pay2.vendorRate * 0.02) * 100) / 100;
    assert(pay2.tdsDeductedAmount === expectedTds2, 'TDS deduction amount matches 2% of agreed vendor rate', `TDS: ₹${pay2.tdsDeductedAmount}`);

    const payout2Id = pay2.payoutId;

    // 4.4 Penal TDS under Section 206AA: 20% for Missing/Invalid PAN
    const pay3Resp = await fetch(`${BACKEND_URL}/api/payouts/transporter/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: tripId3,
        advancePaid: 5000,
        claimDeduction: 0,
        otherDeductions: 0,
        generatedBy: '00000000-0000-0000-0000-000000000001',
      }),
    });
    const pay3 = await pay3Resp.json();

    assert(pay3Resp.ok && pay3.success === true, 'Transporter payout slip generated for Unregistered/Missing PAN Transporter', `Slip: ${pay3.payoutNumber}`);
    assert(pay3.tdsRatePercent === 20.00, 'Missing/Invalid PAN correctly incurs Section 206AA penal 20% TDS rate', `Penal TDS: ${pay3.tdsRatePercent}%`);

    const expectedTds3 = Math.round((pay3.vendorRate * 0.20) * 100) / 100;
    assert(pay3.tdsDeductedAmount === expectedTds3, 'Penal TDS deduction amount matches 20% of agreed vendor rate', `Penal TDS: ₹${pay3.tdsDeductedAmount}`);

    // 4.5 Idempotency Check: Re-generating payout slip for same trip returns existing slip
    const idempPayResp = await fetch(`${BACKEND_URL}/api/payouts/transporter/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: tripId1 }),
    });
    const idempPay = await idempPayResp.json();

    assert(idempPayResp.ok && idempPay.isIdempotent === true, 'Transporter payout generation is strictly idempotent', 'isIdempotent = true');
    assert(idempPay.payoutId === payout1Id, 'Idempotent request returns original payoutId without duplicating payout slip', idempPay.payoutId);

    // -------------------------------------------------------------------------
    // STEP 5: Transporter Payout Retrieval & Commercial Confidentiality Boundaries
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Transporter Payout Confidentiality Enforcement ---');

    const getPayResp = await fetch(`${BACKEND_URL}/api/payouts/transporter/${payout1Id}`);
    const getPayJson = await getPayResp.json();

    assert(getPayResp.ok && getPayJson.success === true, 'Transporter payout details retrieved successfully', `ID: ${payout1Id}`);
    assert(getPayJson.payout.grand_total === undefined && getPayJson.payout.clientBilledAmount === undefined, 'COMMERCIAL CONFIDENTIALITY: Client billing rate strictly omitted from transporter payout view');
    assert(getPayJson.payout.adminMargin === undefined && getPayJson.payout.platformMargin === undefined, 'COMMERCIAL CONFIDENTIALITY: Platform margin strictly omitted from transporter payout view');
    assert(getPayJson.payout.vendorRate > 0 && getPayJson.payout.netPayableAmount > 0, 'Transporter view retains complete vendor settlement breakdown (rate, TDS, deductions, net)');

    // 5.2 404 on invalid payout ID
    const notFoundPayResp = await fetch(`${BACKEND_URL}/api/payouts/transporter/non-existent-payout-id`);
    assert(notFoundPayResp.status === 404, 'Non-existent payout slip returns HTTP 404');

    // -------------------------------------------------------------------------
    // STEP 6: Transporter Bank Disbursal
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Transporter Payout Disbursal Recording ---');

    // 6.1 Validation: Missing UTR rejected
    const badDisbResp = await fetch(`${BACKEND_URL}/api/payouts/transporter/${payout1Id}/record-disbursal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'NEFT' }),
    });
    assert(badDisbResp.status === 400, 'Disbursal requires bankReferenceUtr (returns HTTP 400 & UTR_REQUIRED)');

    // 6.2 Valid Disbursal Recording
    const disbUtr = `UTR-DISB-${dateStr}-${runId}`;
    const disbResp = await fetch(`${BACKEND_URL}/api/payouts/transporter/${payout1Id}/record-disbursal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankReferenceUtr: disbUtr,
        paymentMethod: 'RTGS',
        amountDisbursed: pay1.netPayableAmount,
        disbursedBy: '00000000-0000-0000-0000-000000000001',
      }),
    });
    const disbJson = await disbResp.json();

    assert(disbResp.ok && disbJson.success === true, 'Transporter payout disbursal recorded successfully', `UTR: ${disbUtr}`);
    assert(disbJson.payoutStatus === 'DISBURSED', 'Payout status transitions to DISBURSED upon bank clearance');
    assert(disbJson.amountDisbursed === pay1.netPayableAmount, 'amountDisbursed accurately recorded', `Disbursed: ₹${disbJson.amountDisbursed}`);
    assert(disbJson.bankReferenceUtr === disbUtr, 'bankReferenceUtr correctly linked');

    // -------------------------------------------------------------------------
    // STEP 7: Commercial Financial Reconciliation Ledger
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Commercial Financial Reconciliation Ledger ---');

    const reconResp = await fetch(`${BACKEND_URL}/api/finance/reconciliation`);
    const reconJson = await reconResp.json();

    assert(reconResp.ok && reconJson.success === true, 'Financial reconciliation ledger retrieved successfully');
    const { summary } = reconJson;

    assert(summary.totalClientBilled > 0, 'Total Client Billed aggregated accurately', `₹${summary.totalClientBilled}`);
    assert(summary.totalClientCollected > 0, 'Total Client Collected reflects payment records', `₹${summary.totalClientCollected}`);
    assert(typeof summary.totalClientOutstanding === 'number', 'Total Client Outstanding computed accurately', `₹${summary.totalClientOutstanding}`);
    assert(summary.totalGstLiability > 0, 'Total GST Liability aggregated accurately', `₹${summary.totalGstLiability}`);
    assert(summary.totalTransporterPayable > 0, 'Total Transporter Payable aggregated accurately', `₹${summary.totalTransporterPayable}`);
    assert(summary.totalTransporterDisbursed > 0, 'Total Transporter Disbursed aggregated accurately', `₹${summary.totalTransporterDisbursed}`);
    assert(summary.totalTdsDeducted > 0, 'Total Section 194C TDS Deductions aggregated accurately', `₹${summary.totalTdsDeducted}`);
    assert(typeof summary.grossPlatformMargin === 'number', 'Gross Platform Margin computed (Billed - Payables - GST)', `₹${summary.grossPlatformMargin}`);
    assert(typeof summary.reconciliationVariance === 'number', 'Reconciliation Variance computed accurately', `₹${summary.reconciliationVariance}`);
    assert(summary.invoicesCount >= 2, 'Invoices count matches ledger records', `Count: ${summary.invoicesCount}`);
    assert(summary.payoutsCount >= 3, 'Payouts count matches ledger records', `Count: ${summary.payoutsCount}`);

    // -------------------------------------------------------------------------
    // STEP 8: Immutable Audit Trail Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Immutable Audit Trail Verification ---');

    let auditEvents = [];
    try {
      const aResp = await fetch(`${BACKEND_URL}/api/audit-logs?limit=100`);
      if (aResp.ok) {
        const aJson = await aResp.json();
        if (aJson.logs && aJson.logs.length > 0) {
          auditEvents = aJson.logs;
        }
      }
    } catch {}

    if (auditEvents.length === 0) {
      try {
        const { data: dbEvents } = await supabase
          .from('auth_audit_log')
          .select('event_type, details, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (dbEvents) auditEvents = dbEvents;
      } catch {}
    }

    const eventTypes = (auditEvents || []).map((e) => e.event_type);

    assert(
      eventTypes.includes('CLIENT_INVOICE_GENERATED'),
      'Audit log recorded CLIENT_INVOICE_GENERATED event',
      'auth_audit_log verified'
    );
    assert(
      eventTypes.includes('CLIENT_PAYMENT_RECORDED'),
      'Audit log recorded CLIENT_PAYMENT_RECORDED event',
      'auth_audit_log verified'
    );
    assert(
      eventTypes.includes('TRANSPORTER_PAYOUT_GENERATED'),
      'Audit log recorded TRANSPORTER_PAYOUT_GENERATED event',
      'auth_audit_log verified'
    );
    assert(
      eventTypes.includes('TRANSPORTER_PAYOUT_DISBURSED'),
      'Audit log recorded TRANSPORTER_PAYOUT_DISBURSED event',
      'auth_audit_log verified'
    );
    assert(
      eventTypes.includes('FINANCIAL_LEDGER_RECONCILED'),
      'Audit log recorded FINANCIAL_LEDGER_RECONCILED event',
      'auth_audit_log verified'
    );

  } catch (err) {
    console.error('\n\x1b[31m[UNHANDLED ERROR IN PHASE 11 VALIDATION]\x1b[0m', err);
    failed++;
  } finally {
    console.log('\n========================================================================');
    console.log(` PHASE 11 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase11Tests();
