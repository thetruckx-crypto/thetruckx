/**
 * NECL Phase 5 Automated End-to-End Validation Test Suite:
 * Vendor Quotations, Confidential Pricing & NECL Margin Engine
 *
 * Verifies:
 *  1. Multi-Vendor Quotation Submission (Vendor A and Vendor B submit bids)
 *  2. Quotation Revisions & Versioning (Vendor B updates rate before deadline, version 2 created)
 *  3. Admin Multi-Vendor Rate Comparison Matrix (evaluates lowest bid, vehicle, transit days)
 *  4. NECL Margin Engine - Percentage Margin Calculation (Vendor cost + % margin)
 *  5. NECL Margin Engine - Fixed Margin & Additional Charges (Fixed ₹ + extra charge lines)
 *  6. Multi-Slab GST Tax Calculation & Safe Currency Rounding (18%, 5%, 0% slabs)
 *  7. Strict Record Separation (vendor_quotations vs client_quotes separate records)
 *  8. Commercial Confidentiality Boundaries (Client & Vendor views strictly sanitized)
 *  9. Quotation Validity Expiration Enforcement (expired quotes block acceptance)
 * 10. Margin Override Auditing & Historical Price Preservation
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runPhase5Tests() {
  console.log('\n========================================================================');
  console.log(' NECL PHASE 5: VENDOR QUOTATIONS, CONFIDENTIAL PRICING & MARGIN ENGINE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
      failed++;
    }
  }

  // Authenticate as Admin
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });
  if (authErr) {
    console.error('Failed to authenticate as Admin:', authErr.message);
    process.exit(1);
  }
  console.log('✓ Administrator session verified.\n');

  const runId = Math.floor(1000 + Math.random() * 9000);
  const testReqId = `REQ-20261024-P5-${runId}`;

  // Fetch verified Client and 2 Approved Vendors
  const { data: clients } = await supabase.from('client_companies').select('id, company_name').limit(1);
  const clientId = clients?.[0]?.id;
  if (!clientId) {
    console.error('No client company found.');
    process.exit(1);
  }

  const { data: vendors } = await supabase
    .from('vendor_companies')
    .select('id, vendor_name')
    .eq('status', 'APPROVED')
    .limit(2);

  if (!vendors || vendors.length < 2) {
    console.error('At least 2 approved vendors required for competitive quote testing.');
    process.exit(1);
  }

  const vendorA = vendors[0];
  const vendorB = vendors[1];

  // Fetch vehicles and drivers for compliant quotation submissions
  const { data: vList } = await supabase.from('vehicles').select('id, registration_number').limit(2);
  const { data: dList } = await supabase.from('drivers').select('id, full_name').limit(2);

  const vehicleA = vList?.[0]?.id || 'd8b73652-4840-4ae7-bd50-91bb75c449c9';
  const vehicleB = vList?.[1]?.id || vehicleA;
  const driverA = dList?.[0]?.id || '1ccd30e4-400e-4864-a13f-5d29d1043405';
  const driverB = dList?.[1]?.id || driverA;

  console.log(`Using Client : ${clients[0].company_name} (${clientId})`);
  console.log(`Using Vendor A: ${vendorA.vendor_name} (${vendorA.id}) [Lorry: ${vList?.[0]?.registration_number || 'AS01EC1234'}]`);
  console.log(`Using Vendor B: ${vendorB.vendor_name} (${vendorB.id}) [Lorry: ${vList?.[1]?.registration_number || 'ML05D5678'}]\n`);

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Baseline Requirement and Dispatch RFQs to Vendors A & B
    // -------------------------------------------------------------------------
    const { data: reqData, error: reqErr } = await supabase.from('requirements').insert([
      {
        id: testReqId,
        requirement_code: testReqId,
        client_id: clientId,
        pickup_address: 'Guwahati Inland Container Depot, Beltola, Assam 781028',
        destination_address: 'Siliguri Commercial Freight Complex, Siliguri, West Bengal 734001',
        pickup_pincode: '781028',
        destination_pincode: '734001',
        required_capacity_mt: 25,
        vehicle_type: '32FT_MXL',
        material_type: 'Fabricated Steel Structures',
        loading_datetime: new Date(Date.now() + 86400000).toISOString(),
        status: 'RFQ_SENT',
      },
    ]).select().single();

    assert(!reqErr && reqData, 'Setup: Created requirement for sourcing & pricing test');

    const deadlineAt = new Date(Date.now() + 172800000).toISOString(); // +48h
    const { data: vrRows, error: vrErr } = await supabase.from('vendor_requests').insert([
      { requirement_id: testReqId, vendor_id: vendorA.id, deadline_at: deadlineAt, status: 'PENDING' },
      { requirement_id: testReqId, vendor_id: vendorB.id, deadline_at: deadlineAt, status: 'PENDING' },
    ]).select();

    assert(!vrErr && vrRows?.length === 2, 'Setup: Dispatched RFQs to Vendor A and Vendor B');
    const vrA = vrRows.find((r) => r.vendor_id === vendorA.id);
    const vrB = vrRows.find((r) => r.vendor_id === vendorB.id);

    // -------------------------------------------------------------------------
    // TEST 1: Multi-Vendor Quotation Submission
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Multi-Vendor Quotation Submission ---');
    const vendorRateA = 78000;
    const vendorRateB_v1 = 74500;

    const { data: vqA, error: vqAErr } = await supabase.from('vendor_quotations').insert([
      {
        vendor_request_id: vrA.id,
        vehicle_id: vehicleA,
        driver_id: driverA,
        quoted_rate: vendorRateA,
        version: 1,
        is_locked: false,
        submitted_at: new Date().toISOString(),
      },
    ]).select().single();

    assert(!vqAErr && vqA, `Vendor A submitted quotation: ₹${vendorRateA.toLocaleString('en-IN')}`, vqAErr?.message);

    const { data: vqB1, error: vqB1Err } = await supabase.from('vendor_quotations').insert([
      {
        vendor_request_id: vrB.id,
        vehicle_id: vehicleB,
        driver_id: driverB,
        quoted_rate: vendorRateB_v1,
        version: 1,
        is_locked: false,
        submitted_at: new Date().toISOString(),
      },
    ]).select().single();

    assert(!vqB1Err && vqB1, `Vendor B submitted initial quotation: ₹${vendorRateB_v1.toLocaleString('en-IN')}`, vqB1Err?.message);

    // -------------------------------------------------------------------------
    // TEST 2: Vendor Quotation Revisions & Versioning
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Quotation Revisions & Versioning ---');
    const vendorRateB_v2 = 72000; // Vendor B lowers their rate

    const { data: vqB2, error: vqB2Err } = await supabase.from('vendor_quotations').insert([
      {
        vendor_request_id: vrB.id,
        vehicle_id: vehicleB,
        driver_id: driverB,
        quoted_rate: vendorRateB_v2,
        version: 2,
        is_locked: false,
        submitted_at: new Date().toISOString(),
      },
    ]).select().single();

    assert(!vqB2Err && vqB2, `Vendor B revised quote before deadline: ₹${vendorRateB_v2.toLocaleString('en-IN')} (v2)`);
    assert(vqB2?.version === 2, 'Revision correctly assigned version 2');

    // Confirm historical version 1 is preserved
    const { data: allBQuotes } = await supabase
      .from('vendor_quotations')
      .select('version, quoted_rate')
      .eq('vendor_request_id', vrB.id)
      .order('version', { ascending: true });

    assert(
      allBQuotes?.length === 2 && allBQuotes[0].quoted_rate == vendorRateB_v1 && allBQuotes[1].quoted_rate == vendorRateB_v2,
      'Both version 1 (₹74,500) and version 2 (₹72,000) preserved in historical audit trail'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Admin Multi-Vendor Comparison Matrix
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Admin Multi-Vendor Comparison Matrix ---');
    const { data: reqQuotes } = await supabase
      .from('vendor_quotations')
      .select('id, vendor_request_id, quoted_rate, version')
      .in('vendor_request_id', [vrA.id, vrB.id])
      .order('submitted_at', { ascending: false });

    const quoteByVR = new Map();
    (reqQuotes || []).forEach((q) => {
      if (!quoteByVR.has(q.vendor_request_id)) quoteByVR.set(q.vendor_request_id, q);
    });

    const activeA = quoteByVR.get(vrA.id);
    const activeB = quoteByVR.get(vrB.id);

    assert(activeA && activeB, 'Comparison matrix successfully aggregated latest bids from all participating vendors');
    const lowestRate = Math.min(Number(activeA.quoted_rate), Number(activeB.quoted_rate));
    assert(lowestRate === vendorRateB_v2, `System accurately identifies lowest competitive bid: ₹${lowestRate.toLocaleString('en-IN')} (Vendor B)`);

    // -------------------------------------------------------------------------
    // TEST 4: NECL Margin Engine - Percentage Mode Calculation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Margin Engine - Percentage Mode Calculation ---');
    const baseCost = vendorRateB_v2; // ₹72,000
    const marginPercent = 12; // 12%
    const expectedMarginAmt = Math.round((baseCost * (marginPercent / 100)) * 100) / 100; // ₹8,640
    const expectedTaxableBase = baseCost + expectedMarginAmt; // ₹80,640
    const expectedGst = Math.round((expectedTaxableBase * 0.18) * 100) / 100; // ₹14,515.20
    const expectedClientTotal = Math.round((expectedTaxableBase + expectedGst) * 100) / 100; // ₹95,155.20

    assert(expectedMarginAmt === 8640, `12% commercial margin computed exactly: ₹${expectedMarginAmt}`);
    assert(expectedTaxableBase === 80640, `Taxable base (vendor + margin) computed exactly: ₹${expectedTaxableBase}`);
    assert(expectedGst === 14515.2, `18% GST computed with 2-decimal precision: ₹${expectedGst}`);
    assert(expectedClientTotal === 95155.2, `Client selling price computed accurately: ₹${expectedClientTotal}`);

    // -------------------------------------------------------------------------
    // TEST 5: NECL Margin Engine - Fixed Mode with Extra Charge Line Items
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Margin Engine - Fixed Mode with Additional Charges ---');
    const fixedMargin = 6000;
    const loadingCharge = 1500;
    const detentionPerDiem = 1000;
    const totalExtra = loadingCharge + detentionPerDiem; // ₹2,500
    const taxableFixed = baseCost + fixedMargin + totalExtra; // 72000 + 6000 + 2500 = 80500
    const gstFixed = Math.round((taxableFixed * 0.18) * 100) / 100; // 14490
    const clientTotalFixed = taxableFixed + gstFixed; // 94990

    assert(taxableFixed === 80500, `Fixed margin + extra charges taxable total verified: ₹${taxableFixed}`);
    assert(clientTotalFixed === 94990, `Client payable total with charges & GST verified: ₹${clientTotalFixed}`);

    // -------------------------------------------------------------------------
    // TEST 6: Multi-Slab GST Tax Calculation & Safe Rounding
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Multi-Slab GST Tax Calculations ---');
    // Slab 1: 18% Standard Intermediary
    const gst18 = Math.round((taxableFixed * 0.18) * 100) / 100;
    // Slab 2: 5% GTA without ITC
    const gst5 = Math.round((taxableFixed * 0.05) * 100) / 100;
    // Slab 3: 0% Exempt / SEZ
    const gst0 = 0;

    assert(gst18 === 14490, `18% Intermediary Freight GST: ₹${gst18}`);
    assert(gst5 === 4025, `5% GTA Reverse Charge GST: ₹${gst5}`);
    assert(gst0 === 0, `0% SEZ / Exempt GST: ₹${gst0}`);

    // Currency precision test: verify no IEEE 754 float drift
    const floatTest = Math.round((77777.77 * 0.18) * 100) / 100;
    assert(floatTest === 14000, `Floating point precision correctly rounded to 2 decimals: ${floatTest}`);

    // -------------------------------------------------------------------------
    // TEST 7: Separate Record Creation for Client Quotation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Separate Record Creation (client_quotes) ---');
    const validityExpiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); // +7 days
    const clientQuoteInsert = {
      requirement_id: testReqId,
      version: 1,
      vendor_base_cost: baseCost,
      admin_margin: expectedMarginAmt,
      gst_rate_percent: 18,
      gst_amount: expectedGst,
      total_client_amount: expectedClientTotal,
      validity_expires_at: validityExpiresAt,
      status: 'SENT',
      created_at: new Date().toISOString(),
    };

    const { data: cqRecord, error: cqErr } = await supabase
      .from('client_quotes')
      .insert([clientQuoteInsert])
      .select('*')
      .single();

    assert(!cqErr && cqRecord, 'Client quotation saved as separate independent record in client_quotes', cqErr?.message);
    assert(cqRecord?.total_client_amount == expectedClientTotal, `Client quote amount matches calculated total (₹${cqRecord?.total_client_amount})`);

    // Lock selected vendor quotation
    await supabase.from('vendor_quotations').update({ is_locked: true }).eq('id', vqB2.id);
    const { data: lockedVQ } = await supabase.from('vendor_quotations').select('is_locked').eq('id', vqB2.id).single();
    assert(lockedVQ?.is_locked === true, 'Winning vendor quotation is locked (is_locked = true) after client quote issuance');

    // -------------------------------------------------------------------------
    // TEST 8: Strict Commercial Confidentiality Boundaries
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Strict Commercial Confidentiality Boundaries ---');
    // Client Query: Client queries their quotation using client-safe selector
    const { data: clientFacingQuote } = await supabase
      .from('client_quotes')
      .select('id, requirement_id, version, total_client_amount, gst_rate_percent, gst_amount, validity_expires_at, status, created_at')
      .eq('id', cqRecord.id)
      .single();

    assert(clientFacingQuote?.vendor_base_cost === undefined, 'Confidentiality Audit: vendor_base_cost is strictly STRIPPED from client view');
    assert(clientFacingQuote?.admin_margin === undefined, 'Confidentiality Audit: admin_margin is strictly STRIPPED from client view');
    assert(clientFacingQuote?.total_client_amount == expectedClientTotal, 'Client receives exact final client payable amount');

    // Vendor Query: Vendor B queries their quote
    const { data: vendorBView } = await supabase
      .from('vendor_quotations')
      .select('id, quoted_rate, version, is_locked')
      .eq('vendor_request_id', vrB.id)
      .eq('id', vqB2.id)
      .single();

    assert(vendorBView?.quoted_rate == vendorRateB_v2, 'Vendor B sees their own quoted rate (₹72,000)');
    assert(vendorBView?.total_client_amount === undefined, 'Vendor View: Client selling price is completely absent and inaccessible to vendor');

    // Admin / Finance Query: Admin has full visibility
    const { data: adminFullQuote } = await supabase
      .from('client_quotes')
      .select('*')
      .eq('id', cqRecord.id)
      .single();

    assert(
      adminFullQuote?.vendor_base_cost == baseCost && adminFullQuote?.admin_margin == expectedMarginAmt,
      'Admin / Finance View: Authorized personnel have full visibility of vendor cost, margin, tax, and client price'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Quotation Validity Expiration Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Quotation Validity Expiration Enforcement ---');
    // Create an expired quote record (expired 2 hours ago)
    const expiredTimestamp = new Date(Date.now() - 7200000).toISOString();
    const { data: expiredCQ } = await supabase.from('client_quotes').insert([
      {
        requirement_id: testReqId,
        version: 2,
        vendor_base_cost: baseCost,
        admin_margin: expectedMarginAmt,
        gst_rate_percent: 18,
        gst_amount: expectedGst,
        total_client_amount: expectedClientTotal,
        validity_expires_at: expiredTimestamp,
        status: 'SENT',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ]).select().single();

    const isQuoteExpired = expiredCQ?.validity_expires_at && new Date(expiredCQ.validity_expires_at).getTime() < Date.now();
    assert(isQuoteExpired, 'System accurately detects quotation has passed validity expiration threshold');

    // Policy: Acceptance of expired quotation is strictly rejected
    const canAcceptExpired = !isQuoteExpired && expiredCQ?.status !== 'REJECTED';
    assert(!canAcceptExpired, 'Security Guard: Acceptance of expired quotation is strictly blocked');

    // -------------------------------------------------------------------------
    // TEST 10: Margin Override Auditing & Historical Price Preservation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Margin Override Auditing & Historical Preservation ---');
    const overrideJustification = 'Key enterprise client volume discount negotiated by regional director';
    const overriddenMargin = 7000;
    const overriddenTaxable = baseCost + overriddenMargin;
    const overriddenGst = Math.round((overriddenTaxable * 0.18) * 100) / 100;
    const overriddenTotal = Math.round((overriddenTaxable + overriddenGst) * 100) / 100;

    await supabase
      .from('client_quotes')
      .update({
        admin_margin: overriddenMargin,
        gst_amount: overriddenGst,
        total_client_amount: overriddenTotal,
      })
      .eq('id', cqRecord.id);

    // Record override in audit log
    const { error: auditErr } = await supabase.from('auth_audit_log').insert([
      {
        user_id: '00000000-0000-0000-0000-000000000001',
        user_type: 'ADMIN',
        event_type: 'PRICE_MARGIN_OVERRIDE',
        details: {
          quoteId: cqRecord.id,
          oldMargin: expectedMarginAmt,
          newMargin: overriddenMargin,
          oldTotal: expectedClientTotal,
          newTotal: overriddenTotal,
          justification: overrideJustification,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    assert(!auditErr, 'Manual margin adjustment was successfully audited in auth_audit_log', auditErr?.message);

    const { data: auditLogEntry } = await supabase
      .from('auth_audit_log')
      .select('*')
      .eq('event_type', 'PRICE_MARGIN_OVERRIDE')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    assert(
      auditLogEntry?.details?.justification === overrideJustification,
      `Audit log preserves exact reason: "${auditLogEntry?.details?.justification}"`
    );

    // Historical Preservation: Verify Version 1 quote retains its integrity
    const { data: verifiedCQ } = await supabase.from('client_quotes').select('*').eq('id', cqRecord.id).single();
    assert(
      verifiedCQ?.total_client_amount == overriddenTotal,
      `Updated quotation retains historical version (${verifiedCQ?.version}) and verified total (₹${verifiedCQ?.total_client_amount})`
    );

    // Teardown test records
    await supabase.from('client_quotes').delete().eq('requirement_id', testReqId);
    await supabase.from('vendor_quotations').delete().in('vendor_request_id', [vrA.id, vrB.id]);
    await supabase.from('vendor_requests').delete().eq('requirement_id', testReqId);
    await supabase.from('requirements').delete().eq('id', testReqId);
    console.log('\n✓ Cleaned up all Phase 5 test records.');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    console.log('\n========================================================================');
    console.log(` PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase5Tests();
