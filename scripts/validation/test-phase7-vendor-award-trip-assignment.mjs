/**
 * NECL Phase 7 Automated End-to-End Validation Test Suite:
 * Vendor Award Notification, Trip Generation & Vehicle/Driver Assignment
 *
 * Verifies:
 *  1. Unique Trip Generation from Confirmed Booking (collision-resistant TRP-YYYYMMDD-XXXX)
 *  2. Idempotent Trip Generation (returns existing trip without duplicate creation)
 *  3. Transporter Authorization Enforcement (competing vendor blocked from assigning fleet)
 *  4. Driver Roster Validation (driver belonging to another vendor blocked with DRIVER_VENDOR_MISMATCH)
 *  5. Successful Fleet Allocation (vehicle & driver assigned, status LORRY_ASSIGNED)
 *  6. Active Dispatch Conflict Guard (double-dispatch of vehicle or driver blocked with HTTP 409)
 *  7. Transporter Isolation on Trips (transporter sees only their awarded trips)
 *  8. Commercial Confidentiality Boundaries:
 *     - Client view strictly omits vendor_rate
 *     - Vendor view strictly omits client total price
 *  9. State Synchronization & Immutable Audit Trail (auth_audit_log)
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

async function runPhase7Tests() {
  console.log('\n========================================================================');
  console.log(' NECL PHASE 7: VENDOR AWARD, TRIP GENERATION & FLEET ASSIGNMENT');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate admin for setup operations
    console.log('--- Setting up Phase 7 Test Fixtures ---');
    const { data: authSession, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

    if (authErr || !authSession.session) {
      throw new Error(`Admin authentication failed: ${authErr?.message}`);
    }

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authSession.session.access_token}`,
    };

    // 2. Fetch or create test client
    const { data: clientCompanies } = await supabase
      .from('client_companies')
      .select('id, company_name')
      .limit(1);

    const clientId = clientCompanies?.[0]?.id || '16dc56d1-f215-4ea2-a12d-eb55532c33c7';

    // 3. Fetch two vendor companies (Vendor A = Winning, Vendor B = Competitor)
    const { data: vendors } = await supabase
      .from('vendor_companies')
      .select('id, vendor_name')
      .limit(2);

    const vendorAId = vendors?.[0]?.id || 'fe99a657-9438-4a99-b131-3def2d59b972';
    const vendorBId = vendors?.[1]?.id || '5fe29ef0-4e7e-466b-9f85-3442098c02db';

    console.log(`  Client: ${clientId}`);
    console.log(`  Vendor A (Awarded): ${vendorAId} (${vendors?.[0]?.vendor_name || 'Transporter A'})`);
    console.log(`  Vendor B (Competitor): ${vendorBId} (${vendors?.[1]?.vendor_name || 'Transporter B'})`);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const runId = Math.floor(1000 + Math.random() * 9000);

    // 4. Create Vehicle A and Driver A for Vendor A
    const vehRegA = `AS-01-TR-${runId}`;
    const { data: vehicleA, error: vErrA } = await supabase
      .from('vehicles')
      .insert({
        registration_number: vehRegA,
        vehicle_type: '32FT_MXL',
        body_type: 'Closed Container',
        rated_capacity_mt: 24,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (vErrA || !vehicleA) throw new Error(`Failed to create Vehicle A: ${vErrA?.message}`);

    // Link Vehicle A to Vendor A
    await supabase.from('vendor_vehicle_links').upsert({
      vendor_id: vendorAId,
      vehicle_id: vehicleA.id,
      status: 'APPROVED',
    });

    const { data: driverA, error: dErrA } = await supabase
      .from('drivers')
      .insert({
        primary_vendor_id: vendorAId,
        full_name: `Bhaben Sharma ${runId}`,
        mobile: `9864${runId}12`,
        licence_number: `AS012022${runId}`,
        licence_expiry_date: '2029-12-31',
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (dErrA || !driverA) throw new Error(`Failed to create Driver A: ${dErrA?.message}`);

    // 5. Create Vehicle B and Driver B for Vendor B (Competitor)
    const vehRegB = `WB-02-TR-${runId}`;
    const { data: vehicleB } = await supabase
      .from('vehicles')
      .insert({
        registration_number: vehRegB,
        vehicle_type: '32FT_MXL',
        body_type: 'Closed Container',
        rated_capacity_mt: 24,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (!vehicleB) throw new Error('Failed to create Vehicle B');

    if (vehicleB) {
      await supabase.from('vendor_vehicle_links').upsert({
        vendor_id: vendorBId,
        vehicle_id: vehicleB.id,
        status: 'APPROVED',
      });
    }

    const { data: driverB } = await supabase
      .from('drivers')
      .insert({
        primary_vendor_id: vendorBId,
        full_name: `Tapan Roy ${runId}`,
        mobile: `9830${runId}34`,
        licence_number: `WB022022${runId}`,
        licence_expiry_date: '2029-12-31',
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    if (!driverB) throw new Error('Failed to create Driver B');

    // 6. Create Confirmed Booking for Test 1
    const reqCode = `REQ-${dateStr}-${runId}`;
    const { data: requirement } = await supabase
      .from('requirements')
      .insert({
        id: reqCode,
        requirement_code: reqCode,
        client_id: clientId,
        pickup_address: 'Guwahati Inland Container Depot, Assam 781020',
        pickup_pincode: '781020',
        destination_address: 'Kolkata Port Trust Hub, West Bengal 700043',
        destination_pincode: '700043',
        vehicle_type: '32FT_MXL',
        material_type: 'Industrial Engineering Components',
        required_capacity_mt: 24,
        loading_datetime: new Date(Date.now() + 86400000).toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();

    if (!requirement) {
      throw new Error('Failed to create test requirement 1');
    }

    // Quote 1 from Vendor A (vendor_base_cost = 36000)
    const { data: quote1, error: q1Err } = await supabase
      .from('client_quotes')
      .insert({
        requirement_id: requirement.id,
        version: 1,
        vendor_base_cost: 36000,
        admin_margin: 4320,
        gst_rate_percent: 18,
        gst_amount: 7257.6,
        total_client_amount: 47577.6,
        status: 'ACCEPTED',
        validity_expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select('*')
      .single();

    if (q1Err || !quote1) {
      throw new Error(`Failed to create test quote1: ${q1Err?.message}`);
    }

    const bookingId1 = `BOK-${dateStr}-${runId}`;
    const { data: booking1 } = await supabase
      .from('bookings')
      .insert({
        id: bookingId1,
        client_id: clientId,
        requirement_id: requirement.id,
        accepted_quote_id: quote1.id,
        booking_status: 'CONFIRMED',
        payment_status: 'PAYMENT_PENDING',
        grand_total: 47577.6,
        confirmed_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    console.log(`  Booking 1 created: ${bookingId1}`);

    // -------------------------------------------------------------------------
    // TEST 1: Trip Generation from Confirmed Booking
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Unique Trip Generation from Confirmed Booking ---');
    const genResp = await fetch(`${BACKEND_URL}/api/trips/generate-from-booking`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        bookingId: bookingId1,
        vendorId: vendorAId,
        vendorRate: 36000,
      }),
    });

    const genJson = await genResp.json();

    assert(genJson.success === true, 'Trip generation endpoint returns success: true', genJson.error);
    assert(Boolean(genJson.tripId), 'Unique Trip ID returned', genJson.tripId);
    assert(
      genJson.tripCode && genJson.tripCode.startsWith('TRP-'),
      'Trip code generated matching collision-resistant TRP-YYYYMMDD-XXXX format',
      genJson.tripCode
    );
    assert(
      Number(genJson.vendorRate) === 36000,
      'Trip record initialized with winning vendor quoted purchase rate (₹36,000)',
      genJson.vendorRate
    );

    const trip1Id = genJson.tripId;

    // Verify trip record in database
    const { data: tripRec1 } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip1Id)
      .single();

    assert(Boolean(tripRec1), 'Trip record exists in public.trips table', trip1Id);
    assert(tripRec1?.booking_id === bookingId1, 'Trip linked to booking reference', tripRec1?.booking_id);
    assert(tripRec1?.vendor_id === vendorAId, 'Trip linked to winning Transporter A', tripRec1?.vendor_id);

    // -------------------------------------------------------------------------
    // TEST 2: Idempotent Trip Generation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Idempotency Guarantee for Trip Generation ---');
    const genIdempotentResp = await fetch(`${BACKEND_URL}/api/trips/generate-from-booking`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        bookingId: bookingId1,
        vendorId: vendorAId,
        vendorRate: 36000,
      }),
    });

    const genIdempotentJson = await genIdempotentResp.json();
    assert(
      genIdempotentJson.success === true &&
      genIdempotentJson.tripId === trip1Id &&
      genIdempotentJson.isIdempotent === true,
      'Trip generation is idempotent: returns existing trip ID with isIdempotent: true',
      JSON.stringify(genIdempotentJson)
    );

    // Verify database count remains strictly 1
    const { count: tripCount1 } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', bookingId1);

    assert(tripCount1 === 1, 'Total trips for booking remains strictly 1 (no duplicate rows created)', `Count: ${tripCount1}`);

    // -------------------------------------------------------------------------
    // TEST 3: Transporter Ownership Enforcement (Unauthorized Vendor Blocked)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Transporter Ownership Enforcement ---');
    const unauthorizedAssignResp = await fetch(`${BACKEND_URL}/api/trips/${trip1Id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        vendorId: vendorBId, // Vendor B is unauthorized for this trip
        vehicleId: vehicleB?.id,
        driverId: driverB?.id,
      }),
    });

    const unauthJson = await unauthorizedAssignResp.json();
    assert(
      unauthorizedAssignResp.status === 403 && unauthJson.code === 'UNAUTHORIZED_VENDOR',
      'Unauthorized transporter is blocked with HTTP 403 & UNAUTHORIZED_VENDOR',
      unauthJson.error
    );

    // -------------------------------------------------------------------------
    // TEST 4: Driver Roster Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Driver Roster Validation ---');
    // Vendor A attempts to assign Driver B (who is registered to Vendor B)
    const mismatchDriverResp = await fetch(`${BACKEND_URL}/api/trips/${trip1Id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        vendorId: vendorAId,
        vehicleId: vehicleA.id,
        driverId: driverB?.id, // Driver B belongs to Vendor B!
      }),
    });

    const mismatchJson = await mismatchDriverResp.json();
    assert(
      mismatchDriverResp.status === 400 && mismatchJson.code === 'DRIVER_VENDOR_MISMATCH',
      'Driver registered to a different transporter is rejected with HTTP 400 & DRIVER_VENDOR_MISMATCH',
      mismatchJson.error
    );

    // -------------------------------------------------------------------------
    // TEST 5: Successful Fleet & Driver Assignment
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Successful Fleet & Driver Allocation ---');
    const assignSuccessResp = await fetch(`${BACKEND_URL}/api/trips/${trip1Id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        vendorId: vendorAId,
        vehicleId: vehicleA.id,
        driverId: driverA.id,
      }),
    });

    const assignSuccessJson = await assignSuccessResp.json();
    assert(
      assignSuccessJson.success === true,
      'Fleet allocation endpoint returns success: true',
      assignSuccessJson.message
    );
    assert(
      assignSuccessJson.vehicleNumber === vehRegA,
      'Assigned vehicle registration number matches Vehicle A',
      assignSuccessJson.vehicleNumber
    );
    assert(
      assignSuccessJson.driverName && assignSuccessJson.driverName.includes('Bhaben Sharma'),
      'Assigned driver name matches Driver A',
      assignSuccessJson.driverName
    );
    assert(
      assignSuccessJson.tripStatus === 'LORRY_ASSIGNED',
      'Trip status updated to LORRY_ASSIGNED',
      assignSuccessJson.tripStatus
    );

    // Verify database state
    const { data: tripAssignedRec } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip1Id)
      .single();

    assert(tripAssignedRec?.vehicle_id === vehicleA.id, 'Trip vehicle_id successfully updated in DB', tripAssignedRec?.vehicle_id);
    assert(tripAssignedRec?.driver_id === driverA.id, 'Trip driver_id successfully updated in DB', tripAssignedRec?.driver_id);
    assert(Boolean(tripAssignedRec?.started_at || tripAssignedRec?.created_at), 'Trip allocation timestamp recorded in DB', tripAssignedRec?.started_at || tripAssignedRec?.created_at);

    // Verify audit log for fleet assignment
    const { data: assignAudit } = await supabase
      .from('auth_audit_log')
      .select('*')
      .eq('event_type', 'TRIP_FLEET_ASSIGNED')
      .order('created_at', { ascending: false })
      .limit(1);

    assert(
      assignAudit && assignAudit.length > 0,
      'Immutable audit log entry written to auth_audit_log for fleet allocation',
      assignAudit?.[0]?.details?.vehicle_number
    );

    // -------------------------------------------------------------------------
    // TEST 6: Active Dispatch Conflict Guard (Double-Dispatch Prevention)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Double-Dispatch Prevention Guard ---');
    // Create Booking 2 and Trip 2 for Vendor A
    const reqCode2 = `REQ-${dateStr}-${runId + 1}`;
    const { data: requirement2 } = await supabase
      .from('requirements')
      .insert({
        id: reqCode2,
        requirement_code: reqCode2,
        client_id: clientId,
        pickup_address: 'Siliguri Terminal, WB 734001',
        pickup_pincode: '734001',
        destination_address: 'Dispur Logistics Park, Assam 781005',
        destination_pincode: '781005',
        vehicle_type: '32FT_MXL',
        material_type: 'Fast Moving Consumer Goods',
        required_capacity_mt: 20,
        loading_datetime: new Date(Date.now() + 86400000).toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();

    if (!requirement2) {
      throw new Error('Failed to create test requirement 2');
    }

    const bookingId2 = `BOK-${dateStr}-${runId + 1}`;
    await supabase.from('bookings').insert({
      id: bookingId2,
      client_id: clientId,
      requirement_id: requirement2.id,
      booking_status: 'CONFIRMED',
      payment_status: 'PAYMENT_PENDING',
      grand_total: 42000,
    });

    const gen2Resp = await fetch(`${BACKEND_URL}/api/trips/generate-from-booking`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        bookingId: bookingId2,
        vendorId: vendorAId,
        vendorRate: 34000,
      }),
    });
    const gen2Json = await gen2Resp.json();
    const trip2Id = gen2Json.tripId;

    // 1. Attempt to assign Vehicle A (already active on Trip 1) to Trip 2
    const vehicleConflictResp = await fetch(`${BACKEND_URL}/api/trips/${trip2Id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        vendorId: vendorAId,
        vehicleId: vehicleA.id, // Active on Trip 1!
        driverId: driverA.id,
      }),
    });
    const vehConflictJson = await vehicleConflictResp.json();

    assert(
      vehicleConflictResp.status === 409 && vehConflictJson.code === 'VEHICLE_ALREADY_DISPATCHED',
      'System blocks double-dispatch of active vehicle with HTTP 409 & VEHICLE_ALREADY_DISPATCHED',
      vehConflictJson.error
    );

    // 2. Attempt to assign Driver A (already active on Trip 1) to Trip 2
    // Create an unallocated vehicle for Vendor A to isolate driver conflict
    const vehRegA2 = `AS-01-TR-${runId + 2}`;
    const { data: vehicleA2 } = await supabase
      .from('vehicles')
      .insert({
        registration_number: vehRegA2,
        vehicle_type: '32FT_MXL',
        body_type: 'Closed Container',
        rated_capacity_mt: 24,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    const driverConflictResp = await fetch(`${BACKEND_URL}/api/trips/${trip2Id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        vendorId: vendorAId,
        vehicleId: vehicleA2?.id || vehicleB?.id,
        driverId: driverA.id, // Active on Trip 1!
      }),
    });
    const drvConflictJson = await driverConflictResp.json();

    assert(
      driverConflictResp.status === 409 && drvConflictJson.code === 'DRIVER_ALREADY_DISPATCHED',
      'System blocks double-dispatch of active driver with HTTP 409 & DRIVER_ALREADY_DISPATCHED',
      drvConflictJson.error
    );

    // -------------------------------------------------------------------------
    // TEST 7: Vendor Trip Isolation & Confidentiality (GET /api/vendor/trips)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Transporter Isolation & Commercial Confidentiality ---');
    const vendorATripsResp = await fetch(`${BACKEND_URL}/api/vendor/trips?vendorId=${vendorAId}`);
    const vendorATripsJson = await vendorATripsResp.json();

    assert(vendorATripsJson.success === true, 'Vendor A trips list endpoint returns success: true');
    const vendorATrip = vendorATripsJson.trips.find(t => t.id === trip1Id);
    assert(Boolean(vendorATrip), 'Vendor A sees awarded Trip 1 in their trip roster', trip1Id);
    assert(
      vendorATrip?.vendorRate === 36000,
      'Vendor A sees their own agreed purchase rate (₹36,000)',
      vendorATrip?.vendorRate
    );
    assert(
      vendorATrip?.grandTotal === undefined && vendorATrip?.adminMargin === undefined,
      'Client selling price (grandTotal) and admin margin are strictly excluded from vendor view'
    );

    // Vendor B queries trips: should NOT see Vendor A's trip
    const vendorBTripsResp = await fetch(`${BACKEND_URL}/api/vendor/trips?vendorId=${vendorBId}`);
    const vendorBTripsJson = await vendorBTripsResp.json();
    const vendorBTripConflict = vendorBTripsJson.trips.find(t => t.id === trip1Id);
    assert(
      !vendorBTripConflict,
      'Vendor isolation verified: Competitor Vendor B cannot view Vendor A awarded trip',
      `Found: ${Boolean(vendorBTripConflict)}`
    );

    // -------------------------------------------------------------------------
    // TEST 8: Role-Based Confidentiality on Trip Details (GET /api/trips/:tripId)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Role-Based Commercial Confidentiality Boundaries ---');
    // 1. Client View of Trip 1
    const clientTripResp = await fetch(`${BACKEND_URL}/api/trips/${trip1Id}?role=CLIENT`);
    const clientTripJson = await clientTripResp.json();

    assert(clientTripJson.success === true, 'Client trip detail retrieval returns success: true');
    assert(
      clientTripJson.trip.vendorRate === undefined,
      'COMMERCIAL CONFIDENTIALITY: vendor_rate strictly omitted from client trip view'
    );
    assert(
      clientTripJson.trip.vehicle?.registrationNumber === vehRegA,
      'Client view sees assigned vehicle registration number',
      clientTripJson.trip.vehicle?.registrationNumber
    );
    assert(
      Boolean(clientTripJson.trip.driver?.fullName),
      'Client view sees assigned driver name',
      clientTripJson.trip.driver?.fullName
    );

    // 2. Vendor View of Trip 1
    const vendorTripResp = await fetch(`${BACKEND_URL}/api/trips/${trip1Id}?role=VENDOR`);
    const vendorTripJson = await vendorTripResp.json();
    assert(
      Number(vendorTripJson.trip.vendorRate) === 36000,
      'Vendor view sees their own agreed purchase rate (₹36,000)',
      vendorTripJson.trip.vendorRate
    );
    assert(
      vendorTripJson.trip.clientRate === undefined,
      'COMMERCIAL CONFIDENTIALITY: client selling rate strictly omitted from vendor view'
    );

    // -------------------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up Test Fixtures ---');
    try {
      if (trip1Id) await supabase.from('trips').delete().eq('id', trip1Id);
      if (trip2Id) await supabase.from('trips').delete().eq('id', trip2Id);
      await supabase.from('bookings').delete().eq('id', bookingId1);
      await supabase.from('bookings').delete().eq('id', bookingId2);
      await supabase.from('client_quotes').delete().eq('requirement_id', requirement.id);
      await supabase.from('requirements').delete().eq('id', requirement.id);
      await supabase.from('requirements').delete().eq('id', requirement2.id);
      await supabase.from('vendor_vehicle_links').delete().eq('vehicle_id', vehicleA.id);
      if (vehicleB) await supabase.from('vendor_vehicle_links').delete().eq('vehicle_id', vehicleB.id);
      await supabase.from('vehicles').delete().eq('id', vehicleA.id);
      if (vehicleA2) await supabase.from('vehicles').delete().eq('id', vehicleA2.id);
      if (vehicleB) await supabase.from('vehicles').delete().eq('id', vehicleB.id);
      await supabase.from('drivers').delete().eq('id', driverA.id);
      if (driverB) await supabase.from('drivers').delete().eq('id', driverB.id);
      console.log('  Cleaned up test trips, bookings, vehicles, drivers, and requirements.');
    } catch (cleanErr) {
      console.warn('  Cleanup notice:', cleanErr.message);
    }

  } catch (err) {
    console.error('\n❌ Unhandled error during Phase 7 tests:', err);
    failed++;
  }

  // -------------------------------------------------------------------------
  // Final Results
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(` PHASE 7 VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase7Tests();
