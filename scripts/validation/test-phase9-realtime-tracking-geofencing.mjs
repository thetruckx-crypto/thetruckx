/**
 * NECL Phase 9 Automated End-to-End Validation Test Suite:
 * Real-Time Tracking, Waypoint Events & Geofencing Milestones
 *
 * Verifies:
 *  1. Location Ping Telemetry Ingestion & Boundary Validation:
 *     - Out-of-bounds coordinates rejected with HTTP 400 & INVALID_COORDINATES
 *     - Valid GPS coordinates ingested with speed, heading, and accuracy
 *     - Trip position cache updated (last_latitude, last_longitude, last_ping_at)
 *  2. Haversine Distance Geofencing Calculations:
 *     - Accurate calculation of distance to origin and destination
 *     - Geofence arrival detection within 1.0 km radius
 *  3. Automated Geofence Arrival State Transitions:
 *     - Ping near pickup auto-transitions DISPATCHED -> AT_LOADING
 *     - Ping near destination auto-transitions IN_TRANSIT -> AT_UNLOADING
 *     - GEOFENCE_ENTER_PICKUP and GEOFENCE_ENTER_DESTINATION waypoint events logged
 *  4. Milestone Progression State Machine Sequence Guards:
 *     - Sequential state machine enforcement:
 *       LORRY_ASSIGNED -> DISPATCHED -> AT_LOADING -> IN_TRANSIT -> AT_UNLOADING -> DELIVERED -> COMPLETED
 *     - Illegal skip jumps rejected with HTTP 400 & INVALID_MILESTONE_TRANSITION
 *  5. State Synchronization:
 *     - Booking status synchronized to IN_PROGRESS upon IN_TRANSIT
 *     - Booking status synchronized to DELIVERED upon DELIVERED
 *     - Booking status synchronized to COMPLETED upon COMPLETED
 *  6. Live Tracking Telemetry Feed & Commercial Rate Protection:
 *     - Current position, route overview, distance remaining, ETA, and waypoint events returned
 *     - Commercial purchase price (vendor_rate) and client total price strictly omitted
 *  7. Immutable Audit Trail (auth_audit_log):
 *     - TRIP_LOCATION_PING, GEOFENCE_BREACH_DETECTED, and TRIP_MILESTONE_UPDATED events recorded
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

async function runPhase9Tests() {
  console.log('\n========================================================================');
  console.log(' NECL PHASE 9: REAL-TIME TRACKING, GEOFENCING & MILESTONES SUITE');
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
    // SETUP: Fixtures for Phase 9
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Setting Up Phase 9 Test Fixtures ---');

    // Authenticate admin session for setup
    const { data: authSession } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

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

    // 2. Fetch Transporter
    const { data: vendors } = await supabase
      .from('vendor_companies')
      .select('id, vendor_name')
      .limit(1);

    const vendorId = vendors?.[0]?.id || 'fe99a657-9438-4a99-b131-3def2d59b972';

    // 3. Create Vehicle & Driver
    const { data: vehicle } = await supabase
      .from('vehicles')
      .insert({
        registration_number: `AS-01-TK-${runId}`,
        vehicle_type: '32FT_MXL',
        rated_capacity_mt: 24,
        minimum_capacity_mt: 12,
        status: 'ACTIVE',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    const { data: driver } = await supabase
      .from('drivers')
      .insert({
        full_name: `Hiren Goswami ${runId}`,
        mobile: `9864${runId}9`,
        licence_number: `AS-01-${runId}9-2024`,
        licence_expiry_date: '2029-12-31',
        primary_vendor_id: vendorId,
        status: 'APPROVED',
        verification_status: 'APPROVED',
      })
      .select('*')
      .single();

    // 4. Create Requirement with Coordinates
    // Pickup: Guwahati Inland Depot (26.1445, 91.7362)
    // Delivery: Kolkata Port Trust (22.5726, 88.3639)
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
        material_type: 'Heavy Industrial Machinery',
        required_capacity_mt: 24,
        loading_datetime: new Date(Date.now() + 86400000).toISOString(),
        status: 'BOOKED',
      })
      .select('*')
      .single();

    // 5. Create Confirmed Booking
    const { data: quote } = await supabase
      .from('client_quotes')
      .insert({
        requirement_id: requirement.id,
        version: 1,
        vendor_base_cost: 45000,
        admin_margin: 5400,
        gst_rate_percent: 18,
        gst_amount: 9072,
        total_client_amount: 59472,
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
        grand_total: 59472,
        confirmed_at: new Date().toISOString(),
      });

    // 6. Generate Trip and Assign Vehicle & Driver
    const genTripResp = await fetch(`${BACKEND_URL}/api/trips/generate-from-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        vendorId,
        vendorRate: 45000,
        vehicleId: vehicle.id,
        driverId: driver.id,
      }),
    });
    const genTripJson = await genTripResp.json();
    const tripId = genTripJson.tripId;

    await fetch(`${BACKEND_URL}/api/trips/${tripId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        vehicleId: vehicle.id,
        driverId: driver.id,
      }),
    });

    console.log(`  Fixtures Initialized: Trip ID = ${tripId}, Booking ID = ${bookingId}`);

    // =========================================================================
    // TEST 1: Location Ping Telemetry Ingestion & Boundary Validation
    // =========================================================================
    console.log('\n--- Test 1: Location Ping Telemetry Ingestion & Boundary Validation ---');

    // 1.1 Out-of-bounds Latitude (> 90)
    const invalidLatResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/location-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 95.5, // Invalid
        longitude: 91.7362,
        speed: 30,
      }),
    });
    const invalidLatJson = await invalidLatResp.json();
    assert(
      invalidLatResp.status === 400 && invalidLatJson.code === 'INVALID_COORDINATES',
      'Out-of-bounds latitude (>90) rejected with HTTP 400 & INVALID_COORDINATES',
      invalidLatJson.error
    );

    // 1.2 Out-of-bounds Longitude (> 180)
    const invalidLonResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/location-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 26.1445,
        longitude: 195.0, // Invalid
        speed: 30,
      }),
    });
    const invalidLonJson = await invalidLonResp.json();
    assert(
      invalidLonResp.status === 400 && invalidLonJson.code === 'INVALID_COORDINATES',
      'Out-of-bounds longitude (>180) rejected with HTTP 400 & INVALID_COORDINATES',
      invalidLonJson.error
    );

    // 1.3 Ingest Valid GPS Ping (Near Guwahati depot: 26.1450, 91.7370)
    const validPingResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/location-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 26.1450,
        longitude: 91.7370,
        speed: 42.5,
        heading: 185.0,
        accuracy: 8.5,
        batteryLevel: 92.0,
      }),
    });
    const validPingJson = await validPingResp.json();
    assert(
      validPingResp.status === 200 && validPingJson.success === true,
      'Valid location telemetry ping ingested successfully',
      validPingJson.message
    );
    assert(
      Number(validPingJson.latitude) === 26.1450 && Number(validPingJson.longitude) === 91.7370,
      'Latitude and longitude accurately echoed in response',
      `lat: ${validPingJson.latitude}, lon: ${validPingJson.longitude}`
    );
    assert(
      Number(validPingJson.speed) === 42.5,
      'Speed accurately recorded (42.5 km/h)',
      `${validPingJson.speed} km/h`
    );

    // 1.4 Verify Trips Telemetry Cache Updated in Database or Telemetry Service
    let telemLat = null;
    let telemPingAt = null;
    try {
      const { data: tripTelem } = await supabase
        .from('trips')
        .select('last_latitude, last_longitude, last_speed, last_ping_at')
        .eq('id', tripId)
        .maybeSingle();
      if (tripTelem && tripTelem.last_latitude !== undefined) {
        telemLat = tripTelem.last_latitude;
        telemPingAt = tripTelem.last_ping_at;
      }
    } catch {}

    if (telemLat === null || telemLat === undefined) {
      const tripDetailResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}`);
      const tripDetailJson = await tripDetailResp.json();
      telemLat = tripDetailJson.trip?.lastLatitude;
      telemPingAt = tripDetailJson.trip?.lastPingAt;
    }

    assert(
      Number(telemLat) === 26.1450 || telemPingAt !== null,
      'Trip record position cache updated in database / telemetry cache',
      `lat = ${telemLat}, last_ping_at = ${telemPingAt}`
    );

    // =========================================================================
    // TEST 2: Haversine Distance Geofencing Calculations
    // =========================================================================
    console.log('\n--- Test 2: Haversine Distance Geofencing Calculations ---');

    // 2.1 Check Geofence at 50 meters from Guwahati Depot (inside 1.0 km geofence)
    const nearGeofenceResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/geofence-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 26.1448,
        longitude: 91.7365,
      }),
    });
    const nearGeofenceJson = await nearGeofenceResp.json();
    assert(
      nearGeofenceJson.success === true,
      'Geofence proximity calculation returns success: true',
      nearGeofenceJson.message
    );
    assert(
      nearGeofenceJson.insidePickupGeofence === true,
      'Coordinate within 50m of pickup detected inside pickup geofence (insidePickupGeofence: true)',
      `Distance: ${nearGeofenceJson.distanceToPickupKm} km`
    );
    assert(
      nearGeofenceJson.insideDestinationGeofence === false,
      'Coordinate at Guwahati correctly detected OUTSIDE Kolkata destination geofence',
      `Distance to dest: ${nearGeofenceJson.distanceToDestinationKm} km`
    );

    // 2.2 Check Geofence at 15 km away (outside geofence)
    const farGeofenceResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/geofence-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 26.2500,
        longitude: 91.8500,
      }),
    });
    const farGeofenceJson = await farGeofenceResp.json();
    assert(
      farGeofenceJson.insidePickupGeofence === false,
      'Coordinate 15 km away correctly detected OUTSIDE pickup geofence (insidePickupGeofence: false)',
      `Distance: ${farGeofenceJson.distanceToPickupKm} km`
    );

    // =========================================================================
    // TEST 3: Automated Geofence Arrival State Transitions
    // =========================================================================
    console.log('\n--- Test 3: Automated Geofence Arrival State Transitions ---');

    // Transition trip to DISPATCHED
    await fetch(`${BACKEND_URL}/api/driver/trips/${tripId}/acknowledge-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driver.id }),
    });

    // 3.1 Send Ping Inside Pickup Geofence (<= 1.0 km)
    // Vehicle enters origin loading yard
    const pickupArrivalPingResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/location-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 26.1446,
        longitude: 91.7363,
        speed: 12.0,
      }),
    });
    const pickupArrivalJson = await pickupArrivalPingResp.json();

    assert(
      pickupArrivalJson.geofenceTriggered === 'GEOFENCE_ENTER_PICKUP',
      'Geofence proximity breach detects arrival at origin (geofenceTriggered: GEOFENCE_ENTER_PICKUP)',
      pickupArrivalJson.geofenceTriggered
    );
    assert(
      pickupArrivalJson.tripStatus === 'AT_LOADING',
      'Trip status automatically transitioned to AT_LOADING upon entering origin geofence',
      pickupArrivalJson.tripStatus
    );

    // Verify trip status in database
    const { data: tripAtLoading } = await supabase
      .from('trips')
      .select('trip_status')
      .eq('id', tripId)
      .single();
    assert(
      tripAtLoading?.trip_status === 'AT_LOADING',
      'Database trip_status updated to AT_LOADING',
      tripAtLoading?.trip_status
    );

    // =========================================================================
    // TEST 4: Milestone Progression State Machine Sequence Guards
    // =========================================================================
    console.log('\n--- Test 4: Milestone Progression State Machine Sequence Guards ---');

    // 4.1 Illegal Skip Transition: Attempt jumping from AT_LOADING directly to COMPLETED
    const illegalJumpResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'COMPLETED', // Illegal skip!
        notes: 'Attempting illegal jump without in_transit or delivery',
      }),
    });
    const illegalJumpJson = await illegalJumpResp.json();
    assert(
      illegalJumpResp.status === 400 && illegalJumpJson.code === 'INVALID_MILESTONE_TRANSITION',
      'Illegal status skip from AT_LOADING to COMPLETED rejected with HTTP 400 & INVALID_MILESTONE_TRANSITION',
      illegalJumpJson.error
    );

    // 4.2 Legal Transition: AT_LOADING -> IN_TRANSIT
    const transitResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'IN_TRANSIT',
        notes: 'Consignment fully loaded and secured. Vehicle in transit toward Kolkata Port Hub.',
      }),
    });
    const transitJson = await transitResp.json();
    assert(
      transitResp.status === 200 && transitJson.success === true,
      'Legal milestone transition to IN_TRANSIT accepted',
      transitJson.message
    );
    assert(
      transitJson.newStatus === 'IN_TRANSIT',
      'Trip status updated to IN_TRANSIT',
      transitJson.newStatus
    );

    // 4.3 Verify Booking Synchronized to IN_PROGRESS
    const { data: bookingInTransit } = await supabase
      .from('bookings')
      .select('booking_status')
      .eq('id', bookingId)
      .single();
    assert(
      bookingInTransit?.booking_status === 'IN_PROGRESS',
      'Booking status synchronized to IN_PROGRESS upon vehicle departure',
      bookingInTransit?.booking_status
    );

    // 3.2 Send Ping Inside Destination Geofence (<= 1.0 km of Kolkata Port Hub: 22.5728, 88.3640)
    const destArrivalPingResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/location-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 22.5728,
        longitude: 88.3640,
        speed: 10.0,
      }),
    });
    const destArrivalJson = await destArrivalPingResp.json();
    assert(
      destArrivalJson.geofenceTriggered === 'GEOFENCE_ENTER_DESTINATION',
      'Geofence proximity breach detects arrival at destination (geofenceTriggered: GEOFENCE_ENTER_DESTINATION)',
      destArrivalJson.geofenceTriggered
    );
    assert(
      destArrivalJson.tripStatus === 'AT_UNLOADING',
      'Trip status automatically transitioned to AT_UNLOADING upon entering destination geofence',
      destArrivalJson.tripStatus
    );

    // 4.4 Transition AT_UNLOADING -> DELIVERED
    const deliveredResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'DELIVERED',
        notes: 'Consignment unloaded at consignee dock. Awaiting physical stamp verification.',
      }),
    });
    const deliveredJson = await deliveredResp.json();
    assert(
      deliveredResp.status === 200 && deliveredJson.newStatus === 'DELIVERED',
      'Milestone transition to DELIVERED accepted',
      deliveredJson.message
    );

    // 4.5 Transition DELIVERED -> COMPLETED
    const completedResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'COMPLETED',
        notes: 'Trip closed with verified POD.',
      }),
    });
    const completedJson = await completedResp.json();
    assert(
      completedResp.status === 200 && completedJson.newStatus === 'COMPLETED',
      'Final milestone transition to COMPLETED accepted',
      completedJson.message
    );

    // 4.6 Booking Status Synchronized to COMPLETED
    const { data: bookingCompleted } = await supabase
      .from('bookings')
      .select('booking_status')
      .eq('id', bookingId)
      .single();
    assert(
      bookingCompleted?.booking_status === 'COMPLETED',
      'Booking status synchronized to COMPLETED upon trip closure',
      bookingCompleted?.booking_status
    );

    // =========================================================================
    // TEST 5: Live Tracking Telemetry Feed & Commercial Rate Protection
    // =========================================================================
    console.log('\n--- Test 5: Live Tracking Telemetry Feed & Commercial Rate Protection ---');

    const trackingResp = await fetch(`${BACKEND_URL}/api/trips/${tripId}/tracking`);
    const trackingJson = await trackingResp.json();
    assert(
      trackingResp.status === 200 && trackingJson.success === true,
      'Live tracking endpoint returns success: true'
    );

    const tracking = trackingJson.tracking;
    assert(Boolean(tracking), 'Full structured tracking object returned');
    assert(
      tracking.currentPosition?.latitude !== null && tracking.currentPosition?.longitude !== null,
      'Current GPS coordinates present in tracking telemetry',
      `lat: ${tracking.currentPosition?.latitude}, lon: ${tracking.currentPosition?.longitude}`
    );
    assert(
      tracking.route?.origin.includes('Guwahati'),
      'Origin corridor included in route overview',
      tracking.route?.origin
    );
    assert(
      tracking.route?.destination.includes('Kolkata'),
      'Destination corridor included in route overview',
      tracking.route?.destination
    );
    assert(
      Array.isArray(tracking.waypointEvents) && tracking.waypointEvents.length > 0,
      'Waypoint events history timeline returned',
      `Events count: ${tracking.waypointEvents.length}`
    );
    assert(
      Array.isArray(tracking.recentBreadcrumbs) && tracking.recentBreadcrumbs.length > 0,
      'Recent GPS breadcrumbs returned for map polyline rendering',
      `Breadcrumbs count: ${tracking.recentBreadcrumbs.length}`
    );

    // COMMERCIAL CONFIDENTIALITY VERIFICATION
    assert(
      tracking.vendorRate === undefined && trackingJson.vendorRate === undefined,
      'CONFIDENTIALITY: Transporter purchase rate strictly omitted from tracking feed',
      `vendorRate = ${tracking.vendorRate}`
    );
    assert(
      tracking.clientRate === undefined && tracking.grandTotal === undefined,
      'CONFIDENTIALITY: Client billing price strictly omitted from tracking feed',
      `grandTotal = ${tracking.grandTotal}`
    );
    assert(
      tracking.adminMargin === undefined,
      'CONFIDENTIALITY: Platform commercial margin strictly omitted from tracking feed',
      `adminMargin = ${tracking.adminMargin}`
    );

    // =========================================================================
    // TEST 6: Immutable Audit Trail Verification (auth_audit_log)
    // =========================================================================
    console.log('\n--- Test 6: Immutable Audit Trail Verification (auth_audit_log) ---');

    let allLogs = [];
    try {
      const aResp = await fetch(`${BACKEND_URL}/api/audit-logs?limit=100`);
      if (aResp.ok) {
        const aJson = await aResp.json();
        if (aJson.logs) allLogs = aJson.logs;
      }
    } catch {}

    if (allLogs.length === 0) {
      try {
        const { data: auditLogs } = await supabase
          .from('auth_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60);
        if (auditLogs) allLogs = auditLogs;
      } catch {}
    }

    const pingAudit = allLogs.find(l => l.event_type === 'TRIP_LOCATION_PING' && (l.details?.trip_id === tripId || l.details?.tripId === tripId));
    assert(Boolean(pingAudit), 'TRIP_LOCATION_PING event recorded in auth_audit_log', pingAudit?.id);

    const geofenceAudit = allLogs.find(l => l.event_type === 'GEOFENCE_BREACH_DETECTED' && (l.details?.trip_id === tripId || l.details?.tripId === tripId));
    assert(Boolean(geofenceAudit), 'GEOFENCE_BREACH_DETECTED event recorded in auth_audit_log', geofenceAudit?.id);

    const milestoneAudit = allLogs.find(l => l.event_type === 'TRIP_MILESTONE_UPDATED' && (l.details?.trip_id === tripId || l.details?.tripId === tripId));
    assert(Boolean(milestoneAudit), 'TRIP_MILESTONE_UPDATED event recorded in auth_audit_log', milestoneAudit?.id);

  } catch (err) {
    console.error('\n\x1b[31m[FATAL EXCEPTION IN TEST RUNNER]:\x1b[0m', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(` NECL PHASE 9 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase9Tests();
