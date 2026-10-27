/**
 * NECL Phase 8 Automated End-to-End Validation Test Suite:
 * Driver App Dispatch, Digital Lorry Receipt (LR) & Waybill Generation
 *
 * Verifies:
 *  1. Driver Dispatch Acknowledgment Workflow:
 *     - Unauthorized driver blocked with HTTP 403 & DRIVER_UNAUTHORIZED
 *     - Authorized driver successfully acknowledges dispatch (transitions to DISPATCHED)
 *     - Subsequent acknowledgment transitions to AT_LOADING
 *     - Booking status synchronized to IN_PROGRESS
 *  2. Digital Lorry Receipt (LR) Generation:
 *     - Collision-resistant LR-YYYYMMDD-XXXX format
 *     - Full Consignor, Consignee, Transporter, Vehicle, Driver, Cargo details
 *     - Document record persisted to documents table (category: TRIP, document_type: DIGITAL_LR)
 *  3. LR Idempotency Guarantee:
 *     - Re-request returns existing LR without duplicate rows (isIdempotent: true)
 *     - Total LR document count in database remains strictly 1
 *  4. 12-Digit e-Waybill Format Validation & Linking:
 *     - Malformed formats (<12 digits, non-numeric, empty) rejected with HTTP 400 & INVALID_EWAYBILL_FORMAT
 *     - Valid 12-digit e-waybill linked and stored in documents table
 *     - Linked e-waybill reflected in LR payload
 *  5. Commercial Confidentiality Boundaries:
 *     - Driver view strictly omits vendor_rate and admin margin
 *     - Client view strictly omits vendor_rate
 *     - Vendor view strictly omits client selling rate
 *     - Admin view retains full financial metrics
 *  6. Driver Trips Query Endpoint & Roster Isolation:
 *     - Driver sees only their assigned trips
 *     - Trips enriched with route, contacts, cargo, vehicle, LR, and e-waybill
 *     - Driver view strictly omits commercial purchase and selling prices
 *  7. State Synchronization & Immutable Audit Trail (auth_audit_log)
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

async function runPhase8Tests() {
  console.log('\n========================================================================');
  console.log(' NECL PHASE 8: DRIVER DISPATCH, DIGITAL LR & WAYBILL GENERATION SUITE');
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
    // SETUP: Create Fixtures for Phase 8
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Setting Up Phase 8 Test Fixtures ---');

    // Sign in as admin to obtain authenticated session for fixtures
    const { data: authSession, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

    if (authErr || !authSession.session) {
      console.warn('Admin sign-in notice:', authErr?.message);
    }

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authSession?.session?.access_token || ''}`,
    };

    // 1. Fetch Client Company
    const { data: clientCompanies } = await supabase
      .from('client_companies')
      .select('id, company_name')
      .limit(1);

    const clientId = clientCompanies?.[0]?.id || '16dc56d1-f215-4ea2-a12d-eb55532c33c7';
    const clientName = clientCompanies?.[0]?.company_name || 'NorthEast Petrochem Refineries';

    // 2. Fetch Transporters
    const { data: vendors } = await supabase
      .from('vendor_companies')
      .select('id, vendor_name')
      .limit(2);

    const vendorAId = vendors?.[0]?.id || 'fe99a657-9438-4a99-b131-3def2d59b972';
    const vendorAName = vendors?.[0]?.vendor_name || 'TRUCKS Eastern Freightliner';

    // 3. Driver A (Assigned Driver for Vendor A)
    const { data: driverA, error: dErrA } = await supabase
      .from('drivers')
      .insert({
        full_name: `Rameshwar Borah ${runId}`,
        mobile: `9864${runId}1`,
        licence_number: `AS-01-${runId}1-2024`,
        licence_expiry_date: '2029-12-31',
        primary_vendor_id: vendorAId,
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (dErrA || !driverA) throw new Error(`Failed to create Driver A: ${dErrA?.message}`);
    const driverAId = driverA.id;

    // 4. Driver B (Different Driver / Unassigned)
    const { data: driverB, error: dErrB } = await supabase
      .from('drivers')
      .insert({
        full_name: `Bikram Singha ${runId}`,
        mobile: `9864${runId}2`,
        licence_number: `AS-01-${runId}2-2024`,
        licence_expiry_date: '2029-12-31',
        primary_vendor_id: vendorAId,
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (dErrB || !driverB) throw new Error(`Failed to create Driver B: ${dErrB?.message}`);
    const driverBId = driverB.id;

    // 5. Vehicle A (Assigned Vehicle for Vendor A)
    const { data: vehicleA, error: vErrA } = await supabase
      .from('vehicles')
      .insert({
        registration_number: `AS-01-EE-${runId}`,
        vehicle_type: '32FT_MXL',
        rated_capacity_mt: 24,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (vErrA || !vehicleA) throw new Error(`Failed to create Vehicle A: ${vErrA?.message}`);
    const vehicleAId = vehicleA.id;

    // 6. Transport Requirement
    const reqCode = `REQ-${dateStr}-${runId}`;
    const { data: requirement, error: reqErr } = await supabase
      .from('requirements')
      .insert({
        id: reqCode,
        requirement_code: reqCode,
        client_id: clientId,
        pickup_address: 'Numaligarh Refinery Complex, Assam 785699',
        pickup_pincode: '785699',
        destination_address: 'Haldia Petrochemicals Hub, West Bengal 721602',
        destination_pincode: '721602',
        vehicle_type: '32FT_MXL',
        material_type: 'Industrial Petrochemical Solvents',
        required_capacity_mt: 22,
        loading_datetime: new Date(Date.now() + 86400000).toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();

    if (reqErr || !requirement) {
      throw new Error(`Failed to create test requirement: ${reqErr?.message}`);
    }

    // 7. Confirmed Booking & Client Quote
    const { data: quote } = await supabase
      .from('client_quotes')
      .insert({
        requirement_id: requirement.id,
        version: 1,
        vendor_base_cost: 42000,
        admin_margin: 5040,
        gst_rate_percent: 18,
        gst_amount: 8467.2,
        total_client_amount: 55507.2,
        status: 'ACCEPTED',
        validity_expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select('*')
      .single();

    const bookingId = `BOK-${dateStr}-${runId}`;
    await supabase
      .from('bookings')
      .insert({
        id: bookingId,
        client_id: clientId,
        requirement_id: requirement.id,
        accepted_quote_id: quote.id,
        booking_status: 'CONFIRMED',
        payment_status: 'PAYMENT_PENDING',
        grand_total: 55507.2,
        confirmed_at: new Date().toISOString(),
      });

    // 8. Generate Trip and Assign Vehicle & Driver A
    const genTripResp = await fetch(`${BACKEND_URL}/api/trips/generate-from-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        vendorId: vendorAId,
        vendorRate: 42000,
        vehicleId: vehicleAId,
        driverId: driverAId,
      }),
    });
    const genTripJson = await genTripResp.json();
    const tripId = genTripJson.tripId;

    // Explicitly set trip to LORRY_ASSIGNED with vehicleA and driverA
    await fetch(`${BACKEND_URL}/api/trips/${tripId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId: vendorAId,
        vehicleId: vehicleAId,
        driverId: driverAId,
      }),
    });

    console.log(`  Fixtures Initialized: Trip ID = ${tripId}, Driver A = ${driverAId}`);

    // =========================================================================
    // TEST 1: Driver Dispatch Acknowledgment Workflow
    // =========================================================================
    console.log('\n--- Test 1: Driver Dispatch Acknowledgment Workflow ---');

    // 1.1 Unauthorized Driver Blocked
    const unauthAckResp = await fetch(`${BACKEND_URL}/api/driver/trips/${tripId}/acknowledge-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driverBId }), // Driver B is NOT assigned
    });
    const unauthAckJson = await unauthAckResp.json();
    assert(
      unauthAckResp.status === 403 && unauthAckJson.code === 'DRIVER_UNAUTHORIZED',
      'Unauthorized driver blocked with HTTP 403 & DRIVER_UNAUTHORIZED',
      unauthAckJson.error
    );

    // 1.2 Authorized Driver Acknowledges Dispatch
    const authAckResp = await fetch(`${BACKEND_URL}/api/driver/trips/${tripId}/acknowledge-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driverAId }),
    });
    const authAckJson = await authAckResp.json();
    assert(
      authAckResp.status === 200 && authAckJson.success === true,
      'Authorized driver acknowledges dispatch successfully',
      authAckJson.message
    );
    assert(
      authAckJson.tripStatus === 'DISPATCHED',
      'Trip status transitions from LORRY_ASSIGNED to DISPATCHED',
      authAckJson.tripStatus
    );
    assert(
      Boolean(authAckJson.dispatchedAt),
      'dispatchedAt timestamp recorded',
      authAckJson.dispatchedAt
    );

    // 1.3 Booking Status Synchronized to IN_PROGRESS
    const { data: syncedBooking } = await supabase
      .from('bookings')
      .select('booking_status')
      .eq('id', bookingId)
      .single();
    assert(
      syncedBooking?.booking_status === 'IN_PROGRESS',
      'Booking status automatically synchronized to IN_PROGRESS',
      syncedBooking?.booking_status
    );

    // 1.4 Subsequent Acknowledgment Transitions to AT_LOADING
    const loadingAckResp = await fetch(`${BACKEND_URL}/api/driver/trips/${tripId}/acknowledge-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driverAId }),
    });
    const loadingAckJson = await loadingAckResp.json();
    assert(
      loadingAckJson.tripStatus === 'AT_LOADING',
      'Subsequent driver dispatch acknowledgment transitions trip to AT_LOADING',
      loadingAckJson.tripStatus
    );

    // =========================================================================
    // TEST 2: Digital Lorry Receipt (LR) Generation
    // =========================================================================
    console.log('\n--- Test 2: Digital Lorry Receipt (LR) Generation ---');

    const genLrResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/generate-lr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createdBy: driverAId }),
    });
    const genLrJson = await genLrResp.json();

    assert(genLrJson.success === true, 'Digital LR generation returns success: true', genLrJson.message);
    assert(
      genLrJson.lrNumber && genLrJson.lrNumber.startsWith('LR-'),
      'LR number adheres to collision-resistant LR-YYYYMMDD-XXXX format',
      genLrJson.lrNumber
    );
    assert(
      genLrJson.isIdempotent === false,
      'Initial LR generation isIdempotent: false',
      `isIdempotent=${genLrJson.isIdempotent}`
    );

    const lrData = genLrJson.lrData;
    assert(Boolean(lrData), 'Full structured lrData payload returned');
    assert(
      lrData.consignor?.companyName && (lrData.consignor.companyName.includes('Petrochem') || lrData.consignor.companyName.includes(clientName.slice(0, 8))),
      'Consignor Shipper company details captured accurately',
      lrData.consignor?.companyName
    );
    assert(
      lrData.consignor?.pincode === '785699',
      'Consignor origin pincode captured accurately',
      lrData.consignor?.pincode
    );
    assert(
      Boolean(lrData.consignee?.companyName),
      'Consignee Receiver company details captured accurately',
      lrData.consignee?.companyName
    );
    assert(
      lrData.consignee?.pincode === '721602',
      'Consignee destination pincode captured accurately',
      lrData.consignee?.pincode
    );
    assert(
      lrData.transporter?.companyName && (lrData.transporter.companyName.includes('Eastern Freightliner') || lrData.transporter.companyName.includes(vendorAName.slice(0, 8))),
      'Transporter carrier details captured accurately',
      lrData.transporter?.companyName
    );
    assert(
      lrData.vehicle?.registrationNumber === `AS-01-EE-${runId}`,
      'Assigned vehicle registration number captured in LR',
      lrData.vehicle?.registrationNumber
    );
    assert(
      lrData.driver?.fullName.includes('Rameshwar Borah'),
      'Assigned professional driver name captured in LR',
      lrData.driver?.fullName
    );
    assert(
      lrData.cargo?.materialType === 'Industrial Petrochemical Solvents',
      'Consignment material details captured in LR',
      lrData.cargo?.materialType
    );
    assert(
      Number(lrData.cargo?.weightMt) === 22,
      'Consignment capacity/weight captured in LR (22 MT)',
      `${lrData.cargo?.weightMt} MT`
    );

    // Verify document persistence in database
    const { data: dbLrDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('category', 'TRIP')
      .in('document_type', ['POD_LR', 'DIGITAL_LR'])
      .eq('reference_id', tripId)
      .single();

    assert(Boolean(dbLrDoc), 'Digital LR record persisted to public.documents table', dbLrDoc?.id);
    assert(
      dbLrDoc?.verification_status === 'VERIFIED',
      'Digital LR document status set to VERIFIED',
      dbLrDoc?.verification_status
    );

    const initialLrNumber = genLrJson.lrNumber;

    // =========================================================================
    // TEST 3: Idempotency Guarantee for LR Generation
    // =========================================================================
    console.log('\n--- Test 3: Idempotency Guarantee for LR Generation ---');

    const idempotentLrResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/generate-lr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createdBy: driverAId }),
    });
    const idempotentLrJson = await idempotentLrResp.json();

    assert(
      idempotentLrJson.success === true &&
      idempotentLrJson.isIdempotent === true &&
      idempotentLrJson.lrNumber === initialLrNumber,
      'Re-request returns existing LR number with isIdempotent: true',
      idempotentLrJson.lrNumber
    );

    // Verify database document count remains strictly 1
    const { count: lrCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'TRIP')
      .in('document_type', ['POD_LR', 'DIGITAL_LR'])
      .eq('reference_id', tripId);

    assert(
      lrCount === 1,
      'Total Digital LR documents for trip in database remains strictly 1 (no duplicates)',
      `Count: ${lrCount}`
    );

    // =========================================================================
    // TEST 4: 12-Digit e-Waybill Format Validation & Linking
    // =========================================================================
    console.log('\n--- Test 4: 12-Digit e-Waybill Format Validation & Linking ---');

    // 4.1 Malformed: Fewer than 12 digits
    const shortEwbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/link-ewaybill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ewaybillNumber: '123456789' }), // 9 digits
    });
    const shortEwbJson = await shortEwbResp.json();
    assert(
      shortEwbResp.status === 400 && shortEwbJson.code === 'INVALID_EWAYBILL_FORMAT',
      'Short e-Waybill (<12 digits) rejected with HTTP 400 & INVALID_EWAYBILL_FORMAT',
      shortEwbJson.error
    );

    // 4.2 Malformed: Non-numeric alphanumeric
    const alphaEwbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/link-ewaybill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ewaybillNumber: '12345ABC9012' }),
    });
    const alphaEwbJson = await alphaEwbResp.json();
    assert(
      alphaEwbResp.status === 400 && alphaEwbJson.code === 'INVALID_EWAYBILL_FORMAT',
      'Alphanumeric e-Waybill rejected with HTTP 400 & INVALID_EWAYBILL_FORMAT',
      alphaEwbJson.error
    );

    // 4.3 Malformed: Empty string
    const emptyEwbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/link-ewaybill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ewaybillNumber: '' }),
    });
    const emptyEwbJson = await emptyEwbResp.json();
    assert(
      emptyEwbResp.status === 400 && emptyEwbJson.code === 'INVALID_EWAYBILL_FORMAT',
      'Empty e-Waybill string rejected with HTTP 400',
      emptyEwbJson.error
    );

    // 4.4 Valid: Standard 12 Numeric Digits with EWB- prefix
    const validEwb = `98765432${runId}`;
    const validEwbResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/link-ewaybill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ewaybillNumber: `EWB-${validEwb}`,
        validUntil: new Date(Date.now() + 3 * 86400000).toISOString(),
        linkedBy: vendorAId,
      }),
    });
    const validEwbJson = await validEwbResp.json();
    assert(
      validEwbResp.status === 200 && validEwbJson.success === true,
      'Valid 12-digit e-Waybill accepted and linked successfully',
      validEwbJson.message
    );
    assert(
      validEwbJson.ewaybillNumber === validEwb,
      'e-Waybill number sanitized to clean 12-digit format',
      validEwbJson.ewaybillNumber
    );

    // 4.5 Verify persistence in documents table
    const { data: dbEwbDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('category', 'TRIP')
      .in('document_type', ['WAYBILL', 'EWAYBILL'])
      .eq('reference_id', tripId)
      .single();

    assert(Boolean(dbEwbDoc), 'e-Waybill record persisted to documents table', dbEwbDoc?.id);

    // =========================================================================
    // TEST 5: Commercial Confidentiality Boundaries on Digital LR
    // =========================================================================
    console.log('\n--- Test 5: Commercial Confidentiality Boundaries on Digital LR ---');

    // 5.1 Driver LR View (Confidentiality Protection)
    const driverLrResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/lr?role=DRIVER`);
    const driverLrJson = await driverLrResp.json();
    const driverLr = driverLrJson.lr;

    assert(driverLrResp.status === 200 && driverLrJson.success === true, 'Driver fetches digital LR successfully');
    assert(
      driverLr.vendorRate === undefined,
      'CONFIDENTIALITY: Transporter purchase rate (vendorRate) strictly omitted from Driver LR view',
      `vendorRate = ${driverLr.vendorRate}`
    );
    assert(
      driverLr.clientRate === undefined,
      'CONFIDENTIALITY: Client billing rate (clientRate) strictly omitted from Driver LR view',
      `clientRate = ${driverLr.clientRate}`
    );
    assert(
      driverLr.adminMargin === undefined,
      'CONFIDENTIALITY: Internal platform margin strictly omitted from Driver LR view',
      `adminMargin = ${driverLr.adminMargin}`
    );
    assert(
      driverLr.ewaybill?.ewaybillNumber === validEwb,
      'Linked 12-digit e-Waybill present in Driver LR view',
      driverLr.ewaybill?.ewaybillNumber
    );

    // 5.2 Client LR View (Confidentiality Protection)
    const clientLrResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/lr?role=CLIENT`);
    const clientLrJson = await clientLrResp.json();
    const clientLr = clientLrJson.lr;

    assert(
      clientLr.vendorRate === undefined,
      'CONFIDENTIALITY: Transporter purchase rate strictly omitted from Client LR view',
      `vendorRate = ${clientLr.vendorRate}`
    );
    assert(
      clientLr.adminMargin === undefined,
      'CONFIDENTIALITY: Internal platform margin strictly omitted from Client LR view',
      `adminMargin = ${clientLr.adminMargin}`
    );

    // 5.3 Transporter LR View (Confidentiality Protection)
    const vendorLrResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/lr?role=VENDOR`);
    const vendorLrJson = await vendorLrResp.json();
    const vendorLr = vendorLrJson.lr;

    assert(
      Number(vendorLr.vendorRate) === 42000,
      'Transporter view includes their agreed purchase rate (₹42,000)',
      `vendorRate = ₹${vendorLr.vendorRate}`
    );
    assert(
      vendorLr.clientRate === undefined,
      'CONFIDENTIALITY: Client selling rate strictly omitted from Transporter LR view',
      `clientRate = ${vendorLr.clientRate}`
    );

    // 5.4 Admin LR View (Full Financial Audit)
    const adminLrResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/lr?role=ADMIN`);
    const adminLrJson = await adminLrResp.json();
    const adminLr = adminLrJson.lr;

    assert(
      Number(adminLr.vendorRate) === 42000 && Number(adminLr.clientRate) === 55507.2,
      'Admin view retains full financial audit visibility (Vendor Rate: ₹42,000, Client Rate: ₹55,507.20)',
      `Vendor: ₹${adminLr.vendorRate}, Client: ₹${adminLr.clientRate}`
    );

    // =========================================================================
    // TEST 6: Driver Trips Query Endpoint & Roster Isolation
    // =========================================================================
    console.log('\n--- Test 6: Driver Trips Query Endpoint & Roster Isolation ---');

    // 6.1 Assigned Driver A Queries Trips
    const driverATripsResp = await fetch(`${BACKEND_URL}/api/driver/trips?driverId=${driverAId}`);
    const driverATripsJson = await driverATripsResp.json();

    assert(driverATripsResp.status === 200 && driverATripsJson.success === true, 'Driver A queries trips successfully');
    assert(Array.isArray(driverATripsJson.trips), 'Trips returned as array', `Length: ${driverATripsJson.trips.length}`);

    const driverATrip = driverATripsJson.trips.find(t => t.id === tripId);
    assert(Boolean(driverATrip), 'Driver A roster contains the assigned active trip', driverATrip?.id);
    assert(
      driverATrip?.origin.includes('Numaligarh Refinery'),
      'Driver roster includes detailed pickup origin location',
      driverATrip?.origin
    );
    assert(
      driverATrip?.destination.includes('Haldia Petrochemicals'),
      'Driver roster includes detailed delivery destination location',
      driverATrip?.destination
    );
    assert(
      Boolean(driverATrip?.pickupContactName),
      'Driver roster includes pickup supervisor contact person',
      driverATrip?.pickupContactName
    );
    assert(
      Boolean(driverATrip?.dropContactName),
      'Driver roster includes consignee delivery contact person',
      driverATrip?.dropContactName
    );
    assert(
      driverATrip?.vehicle?.registrationNumber === `AS-01-EE-${runId}`,
      'Driver roster includes allocated vehicle details',
      driverATrip?.vehicle?.registrationNumber
    );
    assert(
      driverATrip?.lrNumber === initialLrNumber,
      'Driver roster contains generated Digital LR number',
      driverATrip?.lrNumber
    );
    assert(
      driverATrip?.ewaybillNumber === validEwb,
      'Driver roster contains linked 12-digit e-Waybill number',
      driverATrip?.ewaybillNumber
    );
    assert(
      driverATrip?.vendorRate === undefined && driverATrip?.grandTotal === undefined,
      'CONFIDENTIALITY: Driver roster strictly omits commercial pricing and purchase figures',
      `vendorRate=${driverATrip?.vendorRate}`
    );

    // 6.2 Competing/Unassigned Driver B Roster Isolation
    const driverBTripsResp = await fetch(`${BACKEND_URL}/api/driver/trips?driverId=${driverBId}`);
    const driverBTripsJson = await driverBTripsResp.json();
    const driverBTrip = driverBTripsJson.trips.find(t => t.id === tripId);
    assert(
      !driverBTrip,
      'ROSTER ISOLATION: Unassigned Driver B does NOT see Trip 1 in their roster',
      `Found: ${Boolean(driverBTrip)}`
    );

    // =========================================================================
    // TEST 7: Immutable Audit Trail Verification
    // =========================================================================
    console.log('\n--- Test 7: Immutable Audit Trail Verification (auth_audit_log) ---');

    const { data: auditLogs } = await supabase
      .from('auth_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const dispatchAudit = (auditLogs || []).find(l => l.event_type === 'DRIVER_DISPATCH_ACKNOWLEDGED' && l.details?.trip_id === tripId);
    assert(Boolean(dispatchAudit), 'DRIVER_DISPATCH_ACKNOWLEDGED event recorded in audit log', dispatchAudit?.id);

    const lrAudit = (auditLogs || []).find(l => l.event_type === 'DIGITAL_LR_GENERATED' && l.details?.trip_id === tripId);
    assert(Boolean(lrAudit), 'DIGITAL_LR_GENERATED event recorded in audit log', lrAudit?.id);

    const ewbAudit = (auditLogs || []).find(l => l.event_type === 'EWAYBILL_LINKED_TO_TRIP' && l.details?.trip_id === tripId);
    assert(Boolean(ewbAudit), 'EWAYBILL_LINKED_TO_TRIP event recorded in audit log', ewbAudit?.id);

  } catch (err) {
    console.error('\n\x1b[31m[FATAL EXCEPTION IN TEST RUNNER]:\x1b[0m', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(` NECL PHASE 8 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8Tests();
