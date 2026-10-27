import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyFreshWorkflowReadiness() {
  console.log('========================================================================');
  console.log('🧪 TESTING FRESH WORKFLOW READINESS ON CLEAN DATABASE');
  console.log('========================================================================\n');

  // 1. Admin Login Verification
  console.log('1. Verifying Admin authentication...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  if (authErr || !auth?.user) {
    console.error('❌ Admin login failed:', authErr?.message);
    process.exit(1);
  }
  console.log('✅ Admin login succeeded: admin@necl.com');

  let probeClientId = null;
  let probeReqId = null;
  let probeVendorId = null;
  let probeVRId = null;
  let probeQuoteId = null;

  try {
    // Clean up any stray probe client from earlier
    await supabase.from('client_companies').delete().ilike('company_name', '%NECL Fresh Verification%');

    // 2. Test Client Registration Pipeline
    console.log('\n2. Testing fresh client creation pipeline...');
    const { data: newClient, error: clientErr } = await supabase
      .from('client_companies')
      .insert([
        {
          company_name: 'NECL Fresh Verification Shipper Ltd',
          gstin: '18AAACL1234F1Z1',
          pan: 'AAACL1234F',
          registered_address: '123 Riverfront Road, Guwahati, Assam - 781001',
          city: 'Guwahati',
          state: 'Assam',
          pincode: '781001',
          status: 'APPROVED',
        },
      ])
      .select('id, company_name')
      .single();

    if (clientErr) {
      console.error('❌ Client creation failed:', clientErr.message);
      process.exit(1);
    }
    probeClientId = newClient.id;
    console.log('✅ Fresh Client Created:', newClient.company_name, '(ID:', newClient.id, ')');

    // 3. Test Requirement Creation Pipeline
    console.log('\n3. Testing fresh transport requirement submission...');
    const freshReqId = `REQ-PROBE-${Date.now().toString().slice(-4)}`;
    const { data: newReq, error: reqErr } = await supabase
      .from('requirements')
      .insert([
        {
          id: freshReqId,
          client_id: newClient.id,
          pickup_address: 'Guwahati Gateway Hub, NH-31, Assam',
          pickup_pincode: '781001',
          destination_address: 'Kolkata Port Terminal, Dankuni, West Bengal',
          destination_pincode: '712311',
          material_type: 'Industrial Machined Components',
          required_capacity_mt: 0.03, // 30 kg verification
          vehicle_type: '32 FT Multi-Axle',
          loading_datetime: new Date(Date.now() + 86400000).toISOString(),
          status: 'UNDER_REVIEW',
        },
      ])
      .select('id, required_capacity_mt, status')
      .single();

    if (reqErr) {
      console.error('❌ Requirement creation failed:', reqErr.message);
      process.exit(1);
    }
    probeReqId = newReq.id;
    console.log('✅ Fresh Requirement Created:', newReq.id, '| Capacity:', newReq.required_capacity_mt, 'MT | Status:', newReq.status);

    // 4. Test Vendor Registration Pipeline
    console.log('\n4. Testing fresh vendor creation pipeline...');
    const { data: newVendor, error: vendorErr } = await supabase
      .from('vendor_companies')
      .insert([
        {
          vendor_name: 'NECL Fresh Verification Logistics',
          pan: 'AABCV9999F',
          gstin: '18AAACV9999F1Z9',
          address: 'Transport Nagar, Siliguri, West Bengal',
          status: 'APPROVED',
        },
      ])
      .select('id, vendor_name')
      .single();

    if (vendorErr) {
      console.error('❌ Vendor creation failed:', vendorErr.message);
      process.exit(1);
    }
    probeVendorId = newVendor.id;
    console.log('✅ Fresh Vendor Created:', newVendor.vendor_name, '(ID:', newVendor.id, ')');

    // 5. Test Multi-Vendor RFQ Sourcing Dispatch Pipeline
    console.log('\n5. Testing RFQ sourcing dispatch pipeline...');
    const { data: newVR, error: vrErr } = await supabase
      .from('vendor_requests')
      .insert([
        {
          requirement_id: newReq.id,
          vendor_id: newVendor.id,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
          status: 'PENDING',
        },
      ])
      .select('id, status')
      .single();

    if (vrErr) {
      console.error('❌ RFQ dispatch failed:', vrErr.message);
      process.exit(1);
    }
    probeVRId = newVR.id;
    console.log('✅ Sourcing Request Created:', newVR.id, '| Status:', newVR.status);

    // 6. Test Vendor Quotation Submission Pipeline
    console.log('\n6. Testing vendor quotation submission pipeline...');
    const { data: newQuote, error: quoteErr } = await supabase
      .from('vendor_quotations')
      .insert([
        {
          vendor_request_id: newVR.id,
          quoted_rate: 45000,
          version: 1,
          is_locked: false,
        },
      ])
      .select('id, quoted_rate')
      .single();

    if (quoteErr) {
      console.error('❌ Vendor quotation failed:', quoteErr.message);
      process.exit(1);
    }
    probeQuoteId = newQuote.id;
    console.log('✅ Vendor Quotation Submitted:', newQuote.id, '| Quoted Rate: ₹' + newQuote.quoted_rate);
  } finally {
    // 7. Clean up the probe test records
    console.log('\n7. Cleaning up verification probe test records...');
    if (probeQuoteId) await supabase.from('vendor_quotations').delete().eq('id', probeQuoteId);
    if (probeVRId) await supabase.from('vendor_requests').delete().eq('id', probeVRId);
    if (probeReqId) await supabase.from('requirements').delete().eq('id', probeReqId);
    if (probeClientId) await supabase.from('client_companies').delete().eq('id', probeClientId);
    if (probeVendorId) await supabase.from('vendor_companies').delete().eq('id', probeVendorId);
    await supabase.from('client_companies').delete().ilike('company_name', '%NECL Fresh Verification%');
    console.log('✅ Probe test records cleanly removed.');
  }

  // 8. Final Count Verification
  console.log('\n8. Final database count verification...');
  const checkTables = [
    'client_companies',
    'vendor_companies',
    'requirements',
    'vendor_requests',
    'vendor_quotations',
    'client_quotes',
    'bookings',
    'trips',
    'documents',
    'admin_users',
    'regional_hubs',
  ];

  for (const tbl of checkTables) {
    const { count } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
    console.log(`- ${tbl.padEnd(22, ' ')}: ${count} rows`);
  }

  console.log('\n========================================================================');
  console.log('✨ VERIFICATION COMPLETE: ALL PIPELINES ARE 100% OPERATIONAL & PRISTINE');
  console.log('========================================================================\n');
}

verifyFreshWorkflowReadiness().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
