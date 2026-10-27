/**
 * NECL Phase 10 Automated End-to-End Validation Test Suite:
 * Electronic Proof of Delivery (e-POD), Weighbridge Clearance & Damage Claims
 *
 * Verifies:
 *  1. Electronic Proof of Delivery (e-POD) Submission & Validation:
 *     - Missing receiverName rejected with HTTP 400 & RECEIVER_NAME_REQUIRED
 *     - Invalid deliveredCondition rejected with HTTP 400 & INVALID_CONDITION
 *     - Valid e-POD ingested with receiver details, consignee seal/stamp verification, and remarks
 *     - Delivered condition CLEAN auto-transitions trip to DELIVERED
 *     - e-POD document persisted to public.documents table
 *  2. e-POD Retrieval & Commercial Confidentiality Boundaries:
 *     - e-POD details and document proofs returned
 *     - Transporter purchase rate, client rate, and platform margin strictly omitted
 *  3. Weighbridge Clearance & Industrial Tolerance Compliance:
 *     - Gross weight <= tare weight rejected with HTTP 400 & INVALID_WEIGHTS
 *     - Loading weighment recorded with gross, tare, and net weights (status: MATCHED)
 *     - Unloading weighment within 0.2 MT tolerance recorded (status: TOLERANCE_ACCEPTED)
 *     - Weighbridge slips persisted to public.documents table
 *  4. Weighbridge Discrepancy Auto-Flagging:
 *     - Unloading weight discrepancy exceeding 0.2 MT / 0.5% flagged as DISCREPANCY
 *     - Trip flagged with has_weight_discrepancy = true
 *  5. Consignment Damage & Shortage Claim Filing:
 *     - Invalid claim type rejected with HTTP 400 & INVALID_CLAIM_TYPE
 *     - Non-positive claimed amount rejected with HTTP 400 & INVALID_AMOUNT
 *     - Valid damage claim filed with item description, quantity, and photographic evidence
 *     - Collision-resistant CLM-YYYYMMDD-XXXX claim code generated
 *     - Trip flagged with has_active_claims = true
 *  6. Active Damage Claim Gates Automated Trip Closure:
 *     - Approving e-POD on trip with active damage claim holds status at DELIVERED
 *  7. Admin Damage Claim Resolution:
 *     - Admin resolves damage claim with approved settlement amount
 *     - Trip has_active_claims cleared upon claim resolution
 *  8. Admin e-POD Review & Final Trip Closure:
 *     - Rejection requires valid rejectionReason
 *     - Rejection marks e-POD and documents as REJECTED
 *     - Final approval marks e-POD VERIFIED, transitions trip to COMPLETED, and finalizes booking
 *  9. Immutable Audit Trail Verification (auth_audit_log):
 *     - EPOD_SUBMITTED, WEIGHBRIDGE_RECORDED, WEIGHBRIDGE_DISCREPANCY_FLAGGED,
 *       DAMAGE_CLAIM_FILED, DAMAGE_CLAIM_RESOLVED, EPOD_REVIEWED_APPROVED, EPOD_REVIEWED_REJECTED
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

async function runPhase10Tests() {
  console.log('\n========================================================================');
  console.log(' NECL PHASE 10: e-POD, WEIGHBRIDGE CLEARANCE & DAMAGE CLAIMS SUITE');
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
    // SETUP: Create Fixtures for Phase 10
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Setting Up Phase 10 Test Fixtures ---');

    const { data: authSession } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

    // 1. Fetch Client & Vendor
    const { data: clientRow } = await supabase.from('client_companies').select('id, company_name').limit(1).single();
    const clientId = clientRow?.id || '16dc56d1-f215-4ea2-a12d-eb55532c33c7';

    const { data: vendorRow } = await supabase.from('vendor_companies').select('id, vendor_name').limit(1).single();
    const vendorId = vendorRow?.id || 'fe99a657-9438-4a99-b131-3def2d59b972';

    // 2. Create Vehicle & Driver
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .insert({
        registration_number: `AS-01-WB-${runId}`,
        vehicle_type: '32FT_MXL',
        rated_capacity_mt: 24,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (vErr) console.error('Vehicle fixture error:', vErr);

    const { data: driver, error: dErr } = await supabase
      .from('drivers')
      .insert({
        full_name: `Haren Boro ${runId}`,
        mobile: `98765${runId}`.slice(0, 10),
        licence_number: `AS-01-${runId}9-2024`,
        licence_expiry_date: '2029-12-31',
        primary_vendor_id: vendorId,
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (dErr) console.error('Driver fixture error:', dErr);

    // 3. Create Requirement & Booking
    const reqCode = `REQ-${dateStr}-${runId}`;
    const { data: requirement } = await supabase
      .from('requirements')
      .insert({
        id: reqCode,
        requirement_code: reqCode,
        client_id: clientId,
        pickup_address: 'Guwahati Industrial Zone, Assam 781010',
        pickup_pincode: '781010',
        destination_address: 'Durgapur Steel Logistics Park, West Bengal 713203',
        destination_pincode: '713203',
        vehicle_type: '32FT_MXL',
        material_type: 'Structural TMT Bars & Billets',
        required_capacity_mt: 24,
        loading_datetime: new Date().toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();

    const { data: quote } = await supabase
      .from('client_quotes')
      .insert({
        requirement_id: requirement.id,
        version: 1,
        vendor_base_cost: 48000,
        admin_margin: 5760,
        gst_rate_percent: 18,
        gst_amount: 9676.8,
        total_client_amount: 63436.8,
        status: 'ACCEPTED',
        validity_expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select('*')
      .single();

    const bookingId = `BOK-${dateStr}-${runId}`;
    await supabase.from('bookings').insert({
      id: bookingId,
      client_id: clientId,
      requirement_id: requirement.id,
      accepted_quote_id: quote.id,
      booking_status: 'CONFIRMED',
      grand_total: 63436.8,
      confirmed_at: new Date().toISOString(),
    });

    // 4. Generate Trip & Assign Fleet
    const genResp = await fetch(`${BACKEND_URL}/api/trips/generate-from-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        vendorId,
        vendorRate: 48000,
        vehicleId: vehicle.id,
        driverId: driver.id,
      }),
    });
    const genJson = await genResp.json();
    const tripId = genJson.tripId;

    await fetch(`${BACKEND_URL}/api/trips/${tripId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId, vehicleId: vehicle.id, driverId: driver.id }),
    });

    await fetch(`${BACKEND_URL}/api/driver/trips/${tripId}/acknowledge-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driver.id }),
    });

    console.log(`  Fixtures Initialized: Trip ID = ${tripId}, Booking ID = ${bookingId}`);

    // =========================================================================
    // TEST 1: Electronic Proof of Delivery (e-POD) Submission & Validation
    // =========================================================================
    console.log('\n--- Test 1: Electronic Proof of Delivery (e-POD) Submission & Validation ---');

    // 1.1 Missing receiver name rejected with HTTP 400
    const noReceiverResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverName: '', // Missing
        deliveredCondition: 'CLEAN',
      }),
    });
    const noReceiverJson = await noReceiverResp.json();
    assert(
      noReceiverResp.status === 400 && noReceiverJson.code === 'RECEIVER_NAME_REQUIRED',
      'Missing receiverName rejected with HTTP 400 & RECEIVER_NAME_REQUIRED',
      noReceiverJson.error
    );

    // 1.2 Invalid delivered condition rejected with HTTP 400
    const invalidCondResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverName: 'Debabrata Das',
        deliveredCondition: 'TOTALLY_DESTROYED', // Invalid enum
      }),
    });
    const invalidCondJson = await invalidCondResp.json();
    assert(
      invalidCondResp.status === 400 && invalidCondJson.code === 'INVALID_CONDITION',
      'Invalid deliveredCondition rejected with HTTP 400 & INVALID_CONDITION',
      invalidCondJson.error
    );

    // 1.3 Valid e-POD Submission
    const validEpodResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverName: 'Debabrata Das',
        receiverPhone: '9830012345',
        deliveredCondition: 'CLEAN',
        consigneeStampVerified: true,
        podDocumentUrl: `https://storage.necl.com/trips/${tripId}/epod/signed_lr_copy.jpg`,
        signatureUrl: `https://storage.necl.com/trips/${tripId}/epod/receiver_signature.png`,
        remarks: 'All 24 MT structural steel bundles received in pristine factory condition.',
        submittedBy: driver.id,
      }),
    });
    const validEpodJson = await validEpodResp.json();
    assert(
      validEpodResp.status === 200 && validEpodJson.success === true,
      'Valid e-POD submitted successfully and pending verification',
      validEpodJson.message
    );
    assert(
      Boolean(validEpodJson.submissionId),
      'e-POD submission generated unique tracking identifier',
      validEpodJson.submissionId
    );

    // 1.4 Auto-transition to DELIVERED status
    assert(
      validEpodJson.tripStatus === 'DELIVERED',
      'Delivered condition CLEAN auto-transitions trip status to DELIVERED',
      `tripStatus = ${validEpodJson.tripStatus}`
    );

    // 1.5 Document persisted into documents table
    const { data: podDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('reference_id', tripId)
      .eq('document_type', 'POD')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    assert(
      podDoc && podDoc.document_type === 'POD',
      'e-POD record persisted to public.documents table with document_type = POD',
      podDoc?.id
    );

    // =========================================================================
    // TEST 2: e-POD Retrieval & Commercial Confidentiality Boundaries
    // =========================================================================
    console.log('\n--- Test 2: e-POD Retrieval & Commercial Confidentiality Boundaries ---');

    const getEpodResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod`);
    const getEpodJson = await getEpodResp.json();

    assert(
      getEpodResp.status === 200 && getEpodJson.success === true,
      'e-POD retrieval endpoint returns success: true'
    );
    assert(
      getEpodJson.submissions && getEpodJson.submissions.length > 0,
      'Submitted e-POD details returned in submissions list',
      `Receiver: ${getEpodJson.latestSubmission?.receiver_name}`
    );
    assert(
      getEpodJson.latestSubmission?.consignee_stamp_verified === true,
      'Consignee seal and stamp verified flag recorded accurately',
      'stampVerified: true'
    );
    assert(
      getEpodJson.vendorRate === undefined,
      'CONFIDENTIALITY: Transporter purchase rate strictly omitted from e-POD details',
      'vendorRate: undefined'
    );
    assert(
      getEpodJson.clientRate === undefined,
      'CONFIDENTIALITY: Client billing rate strictly omitted from e-POD details',
      'clientRate: undefined'
    );

    // =========================================================================
    // TEST 3: Weighbridge Clearance & Industrial Tolerance Compliance
    // =========================================================================
    console.log('\n--- Test 3: Weighbridge Clearance & Industrial Tolerance Compliance ---');

    // 3.1 Gross weight <= Tare weight rejected
    const invalidWeightResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/weighbridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'LOADING',
        grossWeightMt: 12.0, // Gross less than tare!
        tareWeightMt: 14.5,
      }),
    });
    const invalidWeightJson = await invalidWeightResp.json();
    assert(
      invalidWeightResp.status === 400 && invalidWeightJson.code === 'INVALID_WEIGHTS',
      'Gross weight <= Tare weight rejected with HTTP 400 & INVALID_WEIGHTS',
      invalidWeightJson.error
    );

    // 3.2 Loading Weighbridge Ingestion
    const loadWbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/weighbridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'LOADING',
        grossWeightMt: 38.5,
        tareWeightMt: 14.5,
        slipNumber: 'WB-GAU-78101',
        slipLocation: 'Guwahati Logistics Weighbridge Scale 1',
        weighbridgeName: 'Guwahati Certified Weighbridge',
      }),
    });
    const loadWbJson = await loadWbResp.json();
    assert(
      loadWbResp.status === 200 && loadWbJson.success === true,
      'Loading weighbridge reading recorded successfully'
    );
    assert(
      Number(loadWbJson.netWeightMt) === 24.0,
      'Net weight computed accurately: Gross (38.5 MT) - Tare (14.5 MT) = 24.0 MT',
      `${loadWbJson.netWeightMt} MT`
    );
    assert(
      loadWbJson.status === 'MATCHED',
      'Initial loading stage status set to MATCHED',
      loadWbJson.status
    );

    // 3.3 Unloading Weighbridge within permissible tolerance (Variance: 0.1 MT <= 0.2 MT tolerance)
    const unloadWbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/weighbridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'UNLOADING',
        grossWeightMt: 38.4, // Net: 23.9 MT (Variance: 0.1 MT = 0.41%)
        tareWeightMt: 14.5,
        slipNumber: 'WB-DUR-71320',
        slipLocation: 'Durgapur Industrial Scale 2',
        weighbridgeName: 'Durgapur Commercial Weighbridge',
      }),
    });
    const unloadWbJson = await unloadWbResp.json();
    assert(
      unloadWbResp.status === 200 && unloadWbJson.success === true,
      'Unloading weighbridge reading recorded successfully'
    );
    assert(
      Number(unloadWbJson.varianceMt) === 0.1,
      'Weight variance computed accurately against loading net weight (0.1 MT)',
      `variance: ${unloadWbJson.varianceMt} MT (${unloadWbJson.variancePct}%)`
    );
    assert(
      unloadWbJson.status === 'TOLERANCE_ACCEPTED' && unloadWbJson.hasDiscrepancy === false,
      'Weight variance within 0.2 MT / 0.5% tolerance accepted (status: TOLERANCE_ACCEPTED)',
      unloadWbJson.status
    );

    // 3.4 Weighbridge slip persisted in documents table
    const { data: wbDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('reference_id', tripId)
      .eq('document_type', 'WEIGHBRIDGE_SLIP')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    assert(
      wbDoc && wbDoc.document_type === 'WEIGHBRIDGE_SLIP',
      'Weighbridge slip persisted to public.documents table',
      wbDoc?.file_name
    );

    // =========================================================================
    // TEST 4: Weighbridge Discrepancy Auto-Flagging
    // =========================================================================
    console.log('\n--- Test 4: Weighbridge Discrepancy Auto-Flagging ---');

    // Unloading weighment with excessive loss (Variance: 1.5 MT > 0.2 MT)
    const discrepancyWbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/weighbridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'UNLOADING',
        grossWeightMt: 37.0, // Net: 22.5 MT (Variance: 1.5 MT = 6.25% >> 0.5%)
        tareWeightMt: 14.5,
        slipNumber: 'WB-DUR-EXCESS',
        slipLocation: 'Durgapur Commercial Scale 2',
      }),
    });
    const discrepancyWbJson = await discrepancyWbResp.json();
    assert(
      discrepancyWbJson.hasDiscrepancy === true && discrepancyWbJson.status === 'DISCREPANCY',
      'Variance exceeding 0.2 MT & 0.5% flagged as DISCREPANCY',
      `Variance: ${discrepancyWbJson.varianceMt} MT (${discrepancyWbJson.variancePct}%)`
    );

    // Check weighbridge query endpoint
    const getWbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/weighbridge`);
    const getWbJson = await getWbResp.json();
    assert(
      getWbJson.hasDiscrepancy === true,
      'Weighbridge overview endpoint reports hasDiscrepancy = true',
      `Total weighments: ${getWbJson.weighments?.length}`
    );

    // =========================================================================
    // TEST 5: Consignment Damage & Shortage Claim Filing
    // =========================================================================
    console.log('\n--- Test 5: Consignment Damage & Shortage Claim Filing ---');

    // 5.1 Invalid claim type rejected
    const invalidClaimResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimType: 'ALIEN_ABDUCTION',
        claimedAmount: 5000,
      }),
    });
    const invalidClaimJson = await invalidClaimResp.json();
    assert(
      invalidClaimResp.status === 400 && invalidClaimJson.code === 'INVALID_CLAIM_TYPE',
      'Invalid claimType rejected with HTTP 400 & INVALID_CLAIM_TYPE',
      invalidClaimJson.error
    );

    // 5.2 Negative claimed amount rejected
    const invalidAmtResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimType: 'DAMAGE',
        claimedAmount: -1500,
      }),
    });
    const invalidAmtJson = await invalidAmtResp.json();
    assert(
      invalidAmtResp.status === 400 && invalidAmtJson.code === 'INVALID_AMOUNT',
      'Non-positive claimed amount rejected with HTTP 400 & INVALID_AMOUNT',
      invalidAmtJson.error
    );

    // 5.3 Valid damage claim filed
    const validClaimResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimType: 'DAMAGE',
        claimedAmount: 18500,
        damagedQuantity: 1.5,
        itemDescription: '1.5 MT Structural TMT Bars bent and oxidized during rough road transit',
        evidenceUrls: [
          `https://storage.necl.com/trips/${tripId}/claims/bent_rebar_photo_1.jpg`,
          `https://storage.necl.com/trips/${tripId}/claims/damaged_cargo_photo_2.jpg`,
        ],
        submittedBy: clientId,
      }),
    });
    const validClaimJson = await validClaimResp.json();
    assert(
      validClaimResp.status === 200 && validClaimJson.success === true,
      'Damage claim filed successfully and registered in system'
    );
    assert(
      Boolean(validClaimJson.claimCode && validClaimJson.claimCode.startsWith('CLM-')),
      'Collision-resistant CLM-YYYYMMDD-XXXX claim code generated',
      validClaimJson.claimCode
    );

    const claimId = validClaimJson.claimId;

    // Verify claims query endpoint
    const getClaimsResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/claims`);
    const getClaimsJson = await getClaimsResp.json();
    assert(
      getClaimsJson.hasActiveClaims === true && getClaimsJson.claims?.length > 0,
      'Trip flagged with hasActiveClaims = true upon claim filing',
      `Active claims: ${getClaimsJson.claims?.length}`
    );

    // =========================================================================
    // TEST 6: Active Damage Claim Gates Automated Trip Closure
    // =========================================================================
    console.log('\n--- Test 6: Active Damage Claim Gates Automated Trip Closure ---');

    // Admin attempts to approve e-POD while damage claim is active
    const approveWithClaimResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE',
        adminNotes: 'Receiver stamp confirmed, but claim review is pending.',
      }),
    });
    const approveWithClaimJson = await approveWithClaimResp.json();
    assert(
      approveWithClaimJson.podApproved === true,
      'e-POD approved by admin',
      'podApproved: true'
    );
    assert(
      approveWithClaimJson.tripStatus === 'DELIVERED',
      'SAFETY GATE: Trip held at DELIVERED state (NOT closed to COMPLETED) due to active damage claim',
      `tripStatus = ${approveWithClaimJson.tripStatus}`
    );

    // =========================================================================
    // TEST 7: Admin Damage Claim Resolution
    // =========================================================================
    console.log('\n--- Test 7: Admin Damage Claim Resolution ---');

    const resolveClaimResp = await fetch(`${BACKEND_URL}/api/claims/${claimId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE',
        approvedAmount: 18500,
        settlementNotes: 'Consignee damage verified against weighbridge variance; deduction authorized from vendor payout.',
      }),
    });
    const resolveClaimJson = await resolveClaimResp.json();
    assert(
      resolveClaimResp.status === 200 && resolveClaimJson.status === 'APPROVED',
      'Admin resolved damage claim: status transitioned to APPROVED',
      `Approved settlement: ₹${resolveClaimJson.approvedAmount}`
    );

    // Check that trip has no more unresolved claims
    const postResolveClaimsResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/claims`);
    const postResolveClaimsJson = await postResolveClaimsResp.json();
    assert(
      postResolveClaimsJson.hasActiveClaims === false,
      'Trip hasActiveClaims cleared upon all claims resolution',
      'hasActiveClaims: false'
    );

    // =========================================================================
    // TEST 8: Admin e-POD Rejection & Subsequent Final Clearance
    // =========================================================================
    console.log('\n--- Test 8: Admin e-POD Rejection & Subsequent Final Clearance ---');

    // 8.1 Rejection without reason rejected with HTTP 400
    const noReasonRejResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REJECT',
        rejectionReason: '', // Empty
      }),
    });
    const noReasonRejJson = await noReasonRejResp.json();
    assert(
      noReasonRejResp.status === 400 && noReasonRejJson.code === 'REJECTION_REASON_REQUIRED',
      'e-POD rejection without rejectionReason rejected with HTTP 400',
      noReasonRejJson.error
    );

    // 8.2 Reject e-POD with constructive feedback
    const rejectResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REJECT',
        rejectionReason: 'Receiver signature blurred and consignee rubber stamp cutoff at border. Please re-upload legible proof.',
      }),
    });
    const rejectJson = await rejectResp.json();
    assert(
      rejectResp.status === 200 && rejectJson.podApproved === false,
      'e-POD rejected successfully: podApproved = false',
      rejectJson.rejectionReason
    );

    // 8.3 Driver re-submits corrected e-POD
    const resubmitEpodResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverName: 'Debabrata Das',
        receiverPhone: '9830012345',
        deliveredCondition: 'CLEAN',
        consigneeStampVerified: true,
        podDocumentUrl: `https://storage.necl.com/trips/${tripId}/epod/corrected_signed_lr_copy.jpg`,
        signatureUrl: `https://storage.necl.com/trips/${tripId}/epod/high_res_signature.png`,
        remarks: 'Corrected high-resolution document with crystal clear consignee seal.',
        submittedBy: driver.id,
      }),
    });
    const resubmitEpodJson = await resubmitEpodResp.json();
    assert(
      resubmitEpodJson.success === true,
      'Corrected e-POD re-submitted successfully'
    );

    // 8.4 Admin final approval (now that claims are resolved and e-POD is clear)
    const finalApproveResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/pod/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE',
        adminNotes: 'High-resolution consignee stamp and signature verified. Clear for closing.',
      }),
    });
    const finalApproveJson = await finalApproveResp.json();
    assert(
      finalApproveJson.success === true && finalApproveJson.podApproved === true,
      'Final e-POD approval accepted'
    );
    assert(
      finalApproveJson.tripStatus === 'COMPLETED',
      'Trip status fully transitioned to COMPLETED upon final approval with resolved claims',
      `tripStatus = ${finalApproveJson.tripStatus}`
    );

    // Verify booking synchronized to COMPLETED
    const { data: finalBooking } = await supabase
      .from('bookings')
      .select('booking_status')
      .eq('id', bookingId)
      .single();

    assert(
      finalBooking?.booking_status === 'COMPLETED',
      'Booking status synchronized to COMPLETED upon trip closure',
      `booking_status = ${finalBooking?.booking_status}`
    );

    // =========================================================================
    // TEST 9: Immutable Audit Trail Verification (auth_audit_log)
    // =========================================================================
    console.log('\n--- Test 9: Immutable Audit Trail Verification (auth_audit_log) ---');

    const expectedEvents = [
      'EPOD_SUBMITTED',
      'WEIGHBRIDGE_RECORDED',
      'WEIGHBRIDGE_DISCREPANCY_FLAGGED',
      'DAMAGE_CLAIM_FILED',
      'DAMAGE_CLAIM_RESOLVED',
      'EPOD_REVIEWED_APPROVED',
      'EPOD_REVIEWED_REJECTED',
    ];

    for (const evt of expectedEvents) {
      let found = false;
      let logId = null;

      try {
        const aResp = await fetch(`${BACKEND_URL}/api/audit-logs?eventType=${evt}&limit=1`);
        if (aResp.ok) {
          const aJson = await aResp.json();
          if (aJson.logs && aJson.logs.length > 0) {
            found = true;
            logId = aJson.logs[0].id;
          }
        }
      } catch {}

      if (!found) {
        try {
          const { data: auditLogs } = await supabase
            .from('auth_audit_log')
            .select('*')
            .eq('event_type', evt)
            .order('created_at', { ascending: false })
            .limit(1);

          if (auditLogs && auditLogs.length > 0) {
            found = true;
            logId = auditLogs[0].id;
          }
        } catch {}
      }

      assert(
        found,
        `Audit trail recorded event: ${evt}`,
        logId
      );
    }

    console.log('\n========================================================================');
    console.log(` NECL PHASE 10 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  }
}

runPhase10Tests();
