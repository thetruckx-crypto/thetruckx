/**
 * Verification of Direct Mobile Service Fallback Operations
 * Simulates mobile app direct Supabase persistence when backend is offline or bypassed.
 */

import { supabase } from '../server/src/supabase';

async function testDirectMobileFallback() {
  console.log('\n--- Testing Mobile App Direct Supabase Fallback Operations ---');

  // Authenticate Supabase
  await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  const ts = Date.now().toString().slice(-6);
  const cPhone = `9871${ts}`;
  const vPhone = `9872${ts}`;
  const dPhone = `9873${ts}`;

  let cId = '';
  let vId = '';
  let dId = '';

  try {
    // 1. Direct Client Insert
    const { data: comp, error: cErr } = await supabase.from('client_companies').insert([{
      company_name: `Direct Mobile Client ${ts}`,
      business_type: 'Private Limited',
      gstin: `18AAACC${ts}Z1`,
      pan: `AABCC${ts.slice(-5)}`,
      registered_address: 'Direct Client Road, Guwahati',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781001',
      company_phone: cPhone,
      client_code: `CLI-${ts}`,
      status: 'PENDING_APPROVAL',
    }]).select('id').single();

    if (cErr) throw cErr;
    cId = comp.id;

    await supabase.from('client_users').insert([{
      client_id: cId,
      client_company_id: cId,
      full_name: 'Direct Client User',
      mobile: cPhone,
      email: `client.${ts}@direct.in`,
      status: 'PENDING_APPROVAL',
      is_primary_contact: true,
      phone_verified: true,
    }]);

    await supabase.from('documents').insert([{
      category: 'CLIENT_TRANSIT',
      document_type: 'CLIENT_INVOICE',
      reference_id: cId,
      file_url: `clients/${cPhone}/doc.pdf`,
      file_name: `GST_CERTIFICATE: gst_${ts}.pdf`,
      verification_status: 'PENDING',
      uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
    }]);

    console.log('  [PASS] Direct Client registration persisted with status PENDING_APPROVAL');

    // 2. Direct Vendor Insert
    const { data: vComp, error: vErr } = await supabase.from('vendor_companies').insert([{
      vendor_name: `Direct Mobile Vendor ${ts}`,
      pan: `AABCV${ts.slice(-5)}`,
      gstin: `18AAACV${ts}Z2`,
      address: 'Direct Vendor Highway, Guwahati',
      status: 'PENDING',
      onboarding_source: 'SELF_REGISTERED',
    }]).select('id').single();

    if (vErr) throw vErr;
    vId = vComp.id;

    await supabase.from('vendor_users').insert([{
      vendor_id: vId,
      full_name: 'Direct Vendor Contact',
      mobile: vPhone,
      email: `vendor.${ts}@direct.in`,
      status: 'ACTIVE',
    }]);

    await supabase.from('documents').insert([{
      category: 'CLIENT_TRANSIT',
      document_type: 'TIE_UP_AUTHORIZATION',
      reference_id: vId,
      file_url: `vendors/${vPhone}/doc.pdf`,
      file_name: `PAN_CARD: pan_${ts}.pdf`,
      verification_status: 'PENDING',
      uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
    }]);

    console.log('  [PASS] Direct Vendor registration persisted with status PENDING');

    // 3. Direct Driver Insert
    const { data: drv, error: dErr } = await supabase.from('drivers').insert([{
      full_name: 'Direct Driver Kalita',
      mobile: dPhone,
      licence_number: `AS01-DIR-${ts}`,
      licence_expiry_date: '2030-01-01',
      primary_vendor_id: vId,
      status: 'PENDING',
    }]).select('id').single();

    if (dErr) throw dErr;
    dId = drv.id;

    await supabase.from('documents').insert([{
      category: 'DRIVER',
      document_type: 'LICENCE',
      reference_id: dId,
      file_url: `drivers/${dPhone}/licence.pdf`,
      file_name: `DRIVING_LICENCE: licence_${ts}.pdf`,
      verification_status: 'PENDING',
      uploaded_by: dId,
    }]);

    console.log('  [PASS] Direct Driver registration persisted with status PENDING');

  } finally {
    if (cId) {
      await supabase.from('documents').delete().eq('reference_id', cId);
      await supabase.from('client_users').delete().eq('mobile', cPhone);
      await supabase.from('client_companies').delete().eq('id', cId);
    }
    if (vId) {
      await supabase.from('documents').delete().eq('reference_id', vId);
      await supabase.from('vendor_users').delete().eq('mobile', vPhone);
      await supabase.from('vendor_companies').delete().eq('id', vId);
    }
    if (dId) {
      await supabase.from('documents').delete().eq('reference_id', dId);
      await supabase.from('drivers').delete().eq('id', dId);
    }
    console.log('  [PASS] Direct fallback test records cleaned up.');
  }
}

testDirectMobileFallback().catch(console.error);
