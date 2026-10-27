import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runFleetSyncTest() {
  console.log('========================================================================');
  console.log('🚛 NECL FLEET STRENGTH & FLEET DOCUMENTS SYNCHRONIZATION E2E TEST');
  console.log('========================================================================\n');

  const runId = Date.now().toString().slice(-6);
  const testPhone = `9811${runId.slice(-6)}`;
  let testVendorId = null;
  const createdVehIds = [];
  const createdDriverIds = [];
  const createdDocIds = [];

  try {
    // 1. Authenticate Admin session
    console.log('1. Authenticating admin session...');
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });
    if (authError) throw new Error(`Auth failed: ${authError.message}`);
    console.log('  ✓ Authenticated as admin@necl.com\n');

    // 2. Register Vendor Company & User
    console.log('2. Creating Test Vendor Registration with Multiple Vehicles...');
    const vendorName = `Brahmaputra Fleet Services ${runId}`;
    const { data: vComp, error: vErr } = await supabase
      .from('vendor_companies')
      .insert([
        {
          vendor_name: vendorName,
          pan: `ABCDE${runId.slice(-4)}F`,
          gstin: `18ABCDE${runId.slice(-4)}F1Z5`,
          address: 'NH-37 Freight Corridor, Beltola, Guwahati, Assam - 781028',
          vendor_code: `VD-${runId}`,
          status: 'PENDING',
          compliance_status: 'PENDING',
          onboarding_source: 'SELF_REGISTERED',
        },
      ])
      .select('id')
      .single();

    if (vErr || !vComp) throw new Error(`Vendor company creation failed: ${vErr?.message}`);
    testVendorId = vComp.id;
    console.log(`  ✓ Vendor Company created: ${vendorName} [ID: ${testVendorId}]`);

    await supabase.from('vendor_users').insert([
      {
        vendor_id: testVendorId,
        full_name: `Ranjit Bora ${runId}`,
        mobile: testPhone,
        status: 'ACTIVE',
      },
    ]);
    console.log(`  ✓ Vendor User associated with mobile +91 ${testPhone}\n`);

    // 3. Step 5 Fleet Strength: Register Multiple Vehicles & Drivers
    console.log('3. Simulating Step 5 Fleet Strength (Enrolling Multiple Lorries)...');
    const testVehicles = [
      {
        regNo: `AS-01-AB-${runId.slice(-4)}`,
        category: 'Lorry',
        bodyType: 'Open Body',
        capacity: 20,
        ownership: 'Owned',
        driverName: `Pranjal Das ${runId}`,
        driverPhone: `9435${runId.slice(-6)}`,
        driverLicence: `AS-01-${runId}`,
      },
      {
        regNo: `NL-01-CA-${runId.slice(-4)}`,
        category: 'Heavy Carrier',
        bodyType: 'Closed Body',
        capacity: 35,
        ownership: 'Attached',
        driverName: `Manoj Sharma ${runId}`,
        driverPhone: `9436${runId.slice(-6)}`,
        driverLicence: `NL-01-${runId}`,
      },
    ];

    const vehicleIdByReg = new Map();
    const driverIdByReg = new Map();

    for (const v of testVehicles) {
      const minCap = Math.max(1, Math.round(v.capacity * 0.7));
      const { data: vRecord, error: vRecordErr } = await supabase
        .from('vehicles')
        .upsert([
          {
            registration_number: v.regNo,
            vehicle_type: v.category,
            body_type: v.bodyType,
            rated_capacity_mt: v.capacity,
            minimum_capacity_mt: minCap,
            rc_number: v.regNo,
            status: 'ACTIVE',
            verification_status: 'PENDING_DOCS',
            rc_verification_status: 'PENDING',
            insurance_verification_status: 'PENDING',
            fitness_verification_status: 'PENDING',
            permit_verification_status: 'PENDING',
          },
        ], { onConflict: 'registration_number' })
        .select('id, registration_number')
        .single();

      if (vRecordErr || !vRecord) throw new Error(`Vehicle insert failed for ${v.regNo}: ${vRecordErr?.message}`);
      createdVehIds.push(vRecord.id);
      vehicleIdByReg.set(v.regNo, vRecord.id);

      // Link to vendor
      await supabase.from('vendor_vehicle_links').insert([
        {
          vendor_id: testVendorId,
          vehicle_id: vRecord.id,
          status: 'PENDING',
        },
      ]);
      console.log(`  ✓ Vehicle enrolled & linked: ${v.regNo} (${v.capacity} MT ${v.bodyType} ${v.category})`);

      // Driver enrollment
      const { data: dRecord, error: dRecordErr } = await supabase
        .from('drivers')
        .insert([
          {
            primary_vendor_id: testVendorId,
            full_name: v.driverName,
            name: v.driverName,
            mobile: v.driverPhone,
            phone: v.driverPhone,
            licence_number: v.driverLicence,
            license_number: v.driverLicence,
            licence_expiry_date: '2029-12-31',
            status: 'PENDING',
          },
        ])
        .select('id')
        .single();

      if (dRecordErr || !dRecord) throw new Error(`Driver insert failed for ${v.driverName}: ${dRecordErr?.message}`);
      createdDriverIds.push(dRecord.id);
      driverIdByReg.set(v.regNo, dRecord.id);
      console.log(`  ✓ Driver enrolled & linked: ${v.driverName} [DL: ${v.driverLicence}]`);
    }

    // 4. Step 7 Documents: Company KYC + Fleet Documents
    console.log('\n4. Simulating Step 7 Document Uploads (Company KYC + Individual Fleet Docs)...');
    // 4a. Company KYC
    const kycDocs = [
      { type: 'COMPANY_PAN', name: 'PAN_Card.pdf' },
      { type: 'BANK_PASSBOOK', name: 'Cancelled_Cheque.pdf' },
      { type: 'GST_CERTIFICATE', name: 'GST_Registration.pdf' },
    ];
    for (const doc of kycDocs) {
      const { data: dRes, error: dErr } = await supabase.from('documents').insert([
        {
          category: 'CLIENT_TRANSIT',
          document_type: doc.type,
          reference_id: testVendorId,
          file_name: doc.name,
          file_url: `https://necl.in/vendor-docs/${testVendorId}/${doc.type.toLowerCase()}.pdf`,
          file_size: '250 KB',
          mime_type: 'application/pdf',
          verification_status: 'PENDING',
          uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
        },
      ]).select('id').single();
      if (dErr || !dRes) throw new Error(`KYC doc insert failed: ${dErr?.message}`);
      createdDocIds.push(dRes.id);
      console.log(`  ✓ Uploaded Company KYC: ${doc.name} (${doc.type})`);
    }

    // 4b. Fleet & Driver Documents for each lorry
    for (const v of testVehicles) {
      const vehId = vehicleIdByReg.get(v.regNo);
      const drvId = driverIdByReg.get(v.regNo);

      const fleetSlots = [
        { type: 'RC', title: 'Vehicle Registration (RC)', refId: vehId, category: 'VEHICLE' },
        { type: 'FITNESS', title: 'C-Book / Fitness Certificate', refId: vehId, category: 'VEHICLE' },
        { type: 'PERMIT', title: 'Route Permit', refId: vehId, category: 'VEHICLE' },
        { type: 'INSURANCE', title: 'Insurance Policy', refId: vehId, category: 'VEHICLE' },
        { type: 'OTHER', title: 'Pollution Certificate (PUC)', refId: vehId, category: 'VEHICLE' },
        { type: 'LICENCE', title: 'Assigned Driver Licence', refId: drvId, category: 'DRIVER' },
      ];

      for (const slot of fleetSlots) {
        const { data: fdRes, error: fdErr } = await supabase.from('documents').insert([
          {
            category: slot.category,
            document_type: slot.type,
            reference_id: slot.refId,
            file_name: `[${v.regNo}] ${slot.title}.pdf`,
            file_url: `https://necl.in/fleet-docs/${slot.refId}/${slot.type.toLowerCase()}.pdf`,
            file_size: '300 KB',
            mime_type: 'application/pdf',
            verification_status: 'PENDING',
            uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
          },
        ]).select('id').single();
        if (fdErr || !fdRes) throw new Error(`Fleet doc insert failed (${slot.type}): ${fdErr?.message}`);
        createdDocIds.push(fdRes.id);
      }
      console.log(`  ✓ Uploaded all 6 individual documents for ${v.regNo} (RC, C-Book, Permit, Insurance, PUC, DL)`);
    }

    // 5. Verification: Check Admin Queries
    console.log('\n5. Verifying Data Reflection as Viewed in Admin Panel:');

    // 5a. Admin Vendor Profile: Vehicles Tab Query
    const { data: adminVehicles } = await supabase
      .from('vendor_vehicle_links')
      .select('*, vehicles(*)')
      .eq('vendor_id', testVendorId);
    console.log(`  ✓ Admin Vehicles Tab: Found ${adminVehicles?.length} linked vehicles.`);
    if (adminVehicles?.length !== 2) throw new Error('Expected 2 vehicles in Admin Vehicles Tab');

    // 5b. Admin Vendor Profile: Drivers Tab Query
    const { data: adminDrivers } = await supabase
      .from('drivers')
      .select('*')
      .eq('primary_vendor_id', testVendorId);
    console.log(`  ✓ Admin Drivers Tab: Found ${adminDrivers?.length} linked drivers.`);
    if (adminDrivers?.length !== 2) throw new Error('Expected 2 drivers in Admin Drivers Tab');

    // 5c. Admin Vendor Profile: Documents Tab Query (with our enhanced reference_id query)
    const allRefIds = [testVendorId, ...createdVehIds, ...createdDriverIds];
    const { data: adminDocs } = await supabase
      .from('documents')
      .select('*')
      .in('reference_id', allRefIds);
    console.log(`  ✓ Admin Documents Tab: Found ${adminDocs?.length} total documents (KYC + Fleet + Drivers).`);
    // 3 KYC + 2 vehicles * 6 docs = 15 total documents
    if (adminDocs?.length !== 15) throw new Error(`Expected 15 total documents, got ${adminDocs?.length}`);

    // 5d. Admin Document Verification Queue Mapping
    const vehDocCount = adminDocs.filter(d => createdVehIds.includes(d.reference_id)).length;
    const drvDocCount = adminDocs.filter(d => createdDriverIds.includes(d.reference_id)).length;
    const kycDocCount = adminDocs.filter(d => d.reference_id === testVendorId).length;
    console.log(`    - Company KYC: ${kycDocCount} docs`);
    console.log(`    - Vehicle Lorry Documents: ${vehDocCount} docs`);
    console.log(`    - Driver Licence Documents: ${drvDocCount} docs`);

    console.log('\n========================================================================');
    console.log('✅ ALL FLEET STRENGTH & FLEET DOCUMENTS SYNCHRONIZATION TESTS PASSED!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    throw err;
  } finally {
    console.log('🧹 Cleaning up test artifacts...');
    if (createdDocIds.length > 0) {
      await supabase.from('documents').delete().in('id', createdDocIds);
    }
    if (createdVehIds.length > 0) {
      await supabase.from('vendor_vehicle_links').delete().in('vehicle_id', createdVehIds);
      await supabase.from('vehicles').delete().in('id', createdVehIds);
    }
    if (createdDriverIds.length > 0) {
      await supabase.from('drivers').delete().in('id', createdDriverIds);
    }
    if (testVendorId) {
      await supabase.from('vendor_users').delete().eq('vendor_id', testVendorId);
      await supabase.from('vendor_companies').delete().eq('id', testVendorId);
    }
    console.log('  ✓ Cleaned up test vendor, vehicles, drivers, links, and documents.\n');
  }
}

runFleetSyncTest().catch(() => process.exit(1));
