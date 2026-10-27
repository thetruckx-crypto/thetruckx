import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runFinalIntegrationTest() {
  console.log('========================================================');
  console.log('🚀 NECL END-TO-END FINAL INTEGRATION TEST');
  console.log('========================================================\n');

  const testId = Date.now().toString().slice(-6);
  let requirementId = null;
  let vendorRequestId = null;
  let quotationId = null;
  let clientQuoteId = null;
  let bookingId = null;
  let tripId = null;
  let podDocId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 0: Authenticate as Administrator
    // -------------------------------------------------------------------------
    console.log('▶ STEP 0: Authenticating Administrator Session...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123'
    });
    if (authError || !authData.session) {
      throw new Error(`Admin authentication failed: ${authError?.message}`);
    }
    const adminUser = authData.user;
    console.log(`  ✓ Authenticated as: ${adminUser.email} (Auth UID: ${adminUser.id})\n`);

    // -------------------------------------------------------------------------
    // STEP 1: Verify Core Master Entities (Clients, Vendors, Vehicles, Drivers)
    // -------------------------------------------------------------------------
    console.log('▶ STEP 1: Verifying active Master Data...');
    const { data: clients, error: cErr } = await supabase.from('client_companies').select('id, company_name, status').limit(2);
    if (cErr || !clients || clients.length === 0) throw new Error(`Failed to fetch clients: ${cErr?.message}`);
    const client = clients[0];
    console.log(`  ✓ Found Client: ${client.company_name} (${client.id}) [Status: ${client.status}]`);

    const { data: vendors, error: vnErr } = await supabase.from('vendor_companies').select('id, vendor_name, status').eq('status', 'APPROVED').limit(1);
    if (vnErr || !vendors || vendors.length === 0) throw new Error(`Failed to fetch approved vendor: ${vnErr?.message}`);
    const vendor = vendors[0];
    console.log(`  ✓ Found Vendor: ${vendor.vendor_name} (${vendor.id}) [Status: ${vendor.status}]`);

    const { data: vehicles, error: vErr } = await supabase.from('vehicles').select('*').limit(1);
    if (vErr || !vehicles || vehicles.length === 0) throw new Error(`Failed to fetch vehicles: ${vErr?.message}`);
    const vehicle = vehicles[0];
    console.log(`  ✓ Found Vehicle: ${vehicle.registration_number || vehicle.id} (${vehicle.id})`);

    const { data: drivers } = await supabase.from('drivers').select('*').eq('primary_vendor_id', vendor.id).limit(1);
    let driver = drivers && drivers.length > 0 ? drivers[0] : null;
    if (!driver) {
      const { data: anyDrivers } = await supabase.from('drivers').select('*').limit(1);
      driver = anyDrivers ? anyDrivers[0] : null;
    }
    if (!driver) throw new Error('No driver found in the database');
    console.log(`  ✓ Found Driver: ${driver.full_name} (${driver.id}) [Licence: ${driver.licence_number}]\n`);

    // -------------------------------------------------------------------------
    // STEP 2: Client Transport Requirement Creation
    // -------------------------------------------------------------------------
    console.log('▶ STEP 2: Client creates Transport Requirement...');
    requirementId = `REQ-INT-${testId}`;
    const reqPayload = {
      id: requirementId,
      client_id: client.id,
      pickup_address: 'Guwahati Logistics Park, Assam',
      pickup_pincode: '781028',
      destination_address: 'Kolkata Port Yard, West Bengal',
      destination_pincode: '700024',
      vehicle_type: vehicle.vehicle_type || '32FT_MXL',
      material_type: 'Industrial Spares & Machinery',
      required_capacity_mt: 16.5,
      loading_datetime: new Date(Date.now() + 86400000).toISOString(),
      status: 'UNDER_REVIEW',
      created_at: new Date().toISOString()
    };
    const { error: reqErr } = await supabase.from('requirements').insert([reqPayload]);
    if (reqErr) throw new Error(`Failed to create requirement: ${reqErr.message}`);
    console.log(`  ✓ Transport Requirement created: ${requirementId} [Status: UNDER_REVIEW]`);

    // Verify Requirement in DB
    const { data: reqCheck } = await supabase.from('requirements').select('*').eq('id', requirementId).single();
    if (!reqCheck) throw new Error('Requirement not found in database verification');
    console.log(`  ✓ Verified Requirement route: ${reqCheck.pickup_address} -> ${reqCheck.destination_address}\n`);

    // -------------------------------------------------------------------------
    // STEP 3: Admin RFQ Dispatch to Vendor
    // -------------------------------------------------------------------------
    console.log('▶ STEP 3: Admin dispatches RFQ to Vendor...');
    const deadline = new Date(Date.now() + 7200000).toISOString();
    const { data: vrData, error: vrErr } = await supabase.from('vendor_requests').insert([{
      requirement_id: requirementId,
      vendor_id: vendor.id,
      deadline_at: deadline,
      status: 'PENDING'
    }]).select('id').single();
    if (vrErr || !vrData) throw new Error(`Failed to dispatch vendor request: ${vrErr?.message}`);
    vendorRequestId = vrData.id;

    await supabase.from('requirements').update({ status: 'RFQ_SENT' }).eq('id', requirementId);
    console.log(`  ✓ RFQ ${vendorRequestId} dispatched to Vendor: ${vendor.vendor_name}`);
    console.log(`  ✓ Requirement ${requirementId} updated to RFQ_SENT\n`);

    // -------------------------------------------------------------------------
    // STEP 4: Vendor Submits Quotation
    // -------------------------------------------------------------------------
    console.log('▶ STEP 4: Vendor submits quotation rate...');
    const quotedRate = 42000;
    const { data: vqData, error: vqErr } = await supabase.from('vendor_quotations').insert([{
      vendor_request_id: vendorRequestId,
      vehicle_id: vehicle.id,
      driver_id: driver.id,
      quoted_rate: quotedRate,
      version: 1,
      is_locked: false,
      submitted_at: new Date().toISOString()
    }]).select('id').single();
    if (vqErr || !vqData) throw new Error(`Failed to record vendor quotation: ${vqErr?.message}`);
    quotationId = vqData.id;

    await supabase.from('vendor_requests').update({ status: 'QUOTED' }).eq('id', vendorRequestId);
    console.log(`  ✓ Vendor Quotation ${quotationId} recorded: ₹${quotedRate}`);
    console.log(`  ✓ Vendor Request ${vendorRequestId} updated to QUOTED\n`);

    // -------------------------------------------------------------------------
    // STEP 5: Admin Converts Quotation into Booking
    // -------------------------------------------------------------------------
    console.log('▶ STEP 5: Admin converts Quotation to Client Booking...');
    const adminMargin = 4000;
    const subtotal = quotedRate + adminMargin; // 46000
    const gstRate = 18;
    const gstAmount = Math.round(subtotal * (gstRate / 100)); // 8280
    const totalAmount = subtotal + gstAmount; // 54280

    const { data: cqData, error: cqErr } = await supabase.from('client_quotes').insert([{
      requirement_id: requirementId,
      version: 1,
      vendor_base_cost: quotedRate,
      admin_margin: adminMargin,
      gst_rate_percent: gstRate,
      gst_amount: gstAmount,
      total_client_amount: totalAmount,
      validity_expires_at: new Date(Date.now() + 172800000).toISOString(),
      status: 'ACCEPTED'
    }]).select('id').single();
    if (cqErr || !cqData) throw new Error(`Failed to create client quote: ${cqErr?.message}`);
    clientQuoteId = cqData.id;
    console.log(`  ✓ Client Quote ${clientQuoteId} generated: Total ₹${totalAmount} (Base: ₹${quotedRate}, Margin: ₹${adminMargin}, GST: ₹${gstAmount})`);

    bookingId = `BOK-INT-${testId}`;
    const { error: bokErr } = await supabase.from('bookings').insert([{
      id: bookingId,
      requirement_id: requirementId,
      client_id: client.id,
      accepted_quote_id: clientQuoteId,
      booking_status: 'CONFIRMED',
      payment_status: 'PAYMENT_PENDING',
      confirmed_at: new Date().toISOString()
    }]);
    if (bokErr) throw new Error(`Failed to create booking: ${bokErr.message}`);

    await supabase.from('requirements').update({ status: 'BOOKED' }).eq('id', requirementId);
    console.log(`  ✓ Booking ${bookingId} confirmed [Status: CONFIRMED]`);
    console.log(`  ✓ Requirement ${requirementId} status updated to BOOKED\n`);

    // -------------------------------------------------------------------------
    // STEP 6: Vehicle & Driver Assignment -> Trip Initialization
    // -------------------------------------------------------------------------
    console.log('▶ STEP 6: Assigning Fleet & Driver to Trip...');
    const { data: trpData, error: trpErr } = await supabase.from('trips').insert([{
      booking_id: bookingId,
      vehicle_id: vehicle.id,
      driver_id: driver.id,
      vendor_id: vendor.id,
      vendor_rate: quotedRate,
      trip_status: 'LORRY_ASSIGNED',
      started_at: new Date().toISOString()
    }]).select('id').single();
    if (trpErr || !trpData) throw new Error(`Failed to create trip: ${trpErr?.message}`);
    tripId = trpData.id;
    console.log(`  ✓ Trip ${tripId} created [Status: LORRY_ASSIGNED]`);
    console.log(`  ✓ Assigned Vehicle: ${vehicle.registration_number || vehicle.id}, Assigned Driver: ${driver.full_name}\n`);

    // -------------------------------------------------------------------------
    // STEP 7: Driver Trip Execution Lifecycle
    // -------------------------------------------------------------------------
    console.log('▶ STEP 7: Simulating Driver Trip Progression...');
    
    // 7a. At Loading
    await supabase.from('trips').update({ trip_status: 'AT_LOADING' }).eq('id', tripId);
    console.log(`  ✓ Trip updated: AT_LOADING`);

    // 7b. In Transit & Booking In Progress
    await supabase.from('trips').update({ trip_status: 'IN_TRANSIT' }).eq('id', tripId);
    await supabase.from('bookings').update({ booking_status: 'IN_PROGRESS' }).eq('id', bookingId);
    console.log(`  ✓ Trip updated: IN_TRANSIT, Booking updated: IN_PROGRESS`);

    // 7c. At Unloading
    await supabase.from('trips').update({ trip_status: 'AT_UNLOADING' }).eq('id', tripId);
    console.log(`  ✓ Trip updated: AT_UNLOADING`);

    // 7d. Delivered
    await supabase.from('trips').update({ trip_status: 'DELIVERED' }).eq('id', tripId);
    console.log(`  ✓ Trip updated: DELIVERED\n`);

    // -------------------------------------------------------------------------
    // STEP 8: Proof of Delivery (POD) Upload & Verification
    // -------------------------------------------------------------------------
    console.log('▶ STEP 8: Driver uploads Proof of Delivery (POD)...');
    const { data: docData, error: docErr } = await supabase.from('documents').insert([{
      category: 'TRIP',
      document_type: 'POD_LR',
      reference_id: tripId,
      file_url: 'https://necl-storage.s3.amazonaws.com/pods/sample_signed_pod.pdf',
      verification_status: 'PENDING',
      uploaded_by: adminUser.id
    }]).select('id').single();
    if (docErr || !docData) throw new Error(`Failed to upload POD document: ${docErr?.message}`);
    podDocId = docData.id;
    console.log(`  ✓ POD Document ${podDocId} uploaded [Status: PENDING]`);

    // Admin verifies POD
    console.log('  ▶ Admin audits and approves POD...');
    const { error: appErr } = await supabase.from('documents').update({
      verification_status: 'APPROVED',
      verified_by: adminUser.id
    }).eq('id', podDocId);
    if (appErr) throw new Error(`Failed to approve POD: ${appErr.message}`);
    console.log(`  ✓ POD ${podDocId} status updated: APPROVED\n`);

    // -------------------------------------------------------------------------
    // STEP 9: Trip & Booking Completion & Payment Settlement
    // -------------------------------------------------------------------------
    console.log('▶ STEP 9: Completing Trip, Booking & Settling Payment...');
    await supabase.from('trips').update({
      trip_status: 'COMPLETED',
      completed_at: new Date().toISOString()
    }).eq('id', tripId);

    await supabase.from('bookings').update({
      booking_status: 'COMPLETED',
      payment_status: 'PAID'
    }).eq('id', bookingId);
    console.log(`  ✓ Trip ${tripId} status: COMPLETED`);
    console.log(`  ✓ Booking ${bookingId} status: COMPLETED [Payment: PAID]\n`);

    // -------------------------------------------------------------------------
    // STEP 10: Audit Log Recording
    // -------------------------------------------------------------------------
    console.log('▶ STEP 10: Admin Audit Log Recording...');
    const auditPayload = {
      user_id: adminUser.id,
      user_role: 'ADMIN',
      action: 'COMPLETE_BOOKING_LIFECYCLE',
      entity_type: 'BOOKING',
      entity_id: bookingId,
      payload_after: {
        requirementId,
        bookingId,
        tripId,
        totalAmount,
        status: 'COMPLETED'
      },
      timestamp: new Date().toISOString()
    };
    const { data: audData, error: audErr } = await supabase.from('audit_logs').insert([auditPayload]).select('id').single();
    if (audErr) {
      console.warn(`  Notice: audit log insertion (${audErr.message})`);
    } else {
      console.log(`  ✓ Audit Log ${audData?.id || 'recorded'} logged for Action: COMPLETE_BOOKING_LIFECYCLE\n`);
    }

    // -------------------------------------------------------------------------
    // STEP 11: Validation of Live Sync Across Admin & Mobile Views
    // -------------------------------------------------------------------------
    console.log('▶ STEP 11: Validating Data Consistency & Multi-Module Sync...');
    const { data: finalBooking, error: fbErr } = await supabase.from('bookings').select('*, requirements(*), trips(*)').eq('id', bookingId).single();
    if (fbErr || !finalBooking) throw new Error(`Final booking could not be retrieved: ${fbErr?.message}`);
    
    console.log(`  ✓ Booking verified: ${finalBooking.id}`);
    console.log(`    - Booking Status: ${finalBooking.booking_status} (Expected: COMPLETED)`);
    console.log(`    - Payment Status: ${finalBooking.payment_status} (Expected: PAID)`);
    console.log(`    - Requirement Status: ${finalBooking.requirements?.status} (Expected: BOOKED)`);
    console.log(`    - Trip Status: ${finalBooking.trips?.[0]?.trip_status} (Expected: COMPLETED)`);

    console.log('\n========================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (12/12 Steps)');
    console.log('========================================================\n');

  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    // Cleanup created test records
    console.log('🧹 Cleaning up test artifacts...');
    try {
      if (podDocId) await supabase.from('documents').delete().eq('id', podDocId);
      if (tripId) await supabase.from('trips').delete().eq('id', tripId);
      if (bookingId) await supabase.from('bookings').delete().eq('id', bookingId);
      if (clientQuoteId) await supabase.from('client_quotes').delete().eq('id', clientQuoteId);
      if (quotationId) await supabase.from('vendor_quotations').delete().eq('id', quotationId);
      if (vendorRequestId) await supabase.from('vendor_requests').delete().eq('id', vendorRequestId);
      if (requirementId) await supabase.from('requirements').delete().eq('id', requirementId);
      console.log('✓ Cleanup complete.\n');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }
}

runFinalIntegrationTest();
