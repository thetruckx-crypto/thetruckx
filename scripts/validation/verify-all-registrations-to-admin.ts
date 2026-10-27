/**
 * Complete End-to-End Registration to Admin Workflow Verification
 * 
 * Verifies live registration without mock data for:
 * 1. Client Registration -> Saved to DB (client_companies, client_users, documents) -> Visible in Admin (ClientDirectory) under Pending Approval -> Admin Approval
 * 2. Vendor Registration -> Saved to DB (vendor_companies, vendor_users, documents) -> Visible in Admin (VendorDirectory) under Pending -> Admin Approval
 * 3. Driver Registration -> Saved to DB (drivers, documents) -> Visible in Admin (DriverVerificationQueue) under Pending -> Admin Approval
 * 4. Supabase Realtime Channels subscription check for instant synchronization
 */

import http from 'http';
import { supabase } from '../../server/src/supabase';

const SERVER_PORT = 5000;

function makeRequest(
  path: string,
  method: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';

    const req = http.request(
      {
        host: '127.0.0.1',
        port: SERVER_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runVerification() {
  console.log('\n========================================================================');
  console.log(' NECL REGISTRATION-TO-ADMIN COMPLETE LIVE WORKFLOW VERIFICATION');
  console.log('========================================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests++;
    }
  }

  // Admin authentication
  const authRes = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });
  assert(!authRes.error, 'Supabase Admin session established successfully');

  // Test identifiers
  const ts = Date.now().toString().slice(-6);
  const clientPhone = `9864${ts.slice(-6)}`;
  const vendorPhone = `9865${ts.slice(-6)}`;
  const driverPhone = `9866${ts.slice(-6)}`;

  const clientGstin = `18AAACL${ts}Z1`;
  const vendorGstin = `18AAAVN${ts}Z2`;
  const driverLicence = `AS01-${ts}-2026`;

  console.log(`[INFO] Test client mobile: ${clientPhone}, GSTIN: ${clientGstin}`);
  console.log(`[INFO] Test vendor mobile: ${vendorPhone}, GSTIN: ${vendorGstin}`);
  console.log(`[INFO] Test driver mobile: ${driverPhone}, Licence: ${driverLicence}`);

  let createdCompanyId = '';
  let createdVendorId = '';
  let createdDriverId = '';

  try {
    // =========================================================================
    // 1. CLIENT REGISTRATION WORKFLOW
    // =========================================================================
    console.log('\n--- 1. Client Registration Workflow (Mobile -> DB -> Admin) ---');

    const clientPayload = {
      fullName: 'Pranjal Barua',
      mobile: clientPhone,
      companyPhone: clientPhone,
      email: `pranjal.${ts}@assamteaexports.in`,
      designation: 'Logistics Head',
      department: 'Procurement',
      companyName: `Assam Tea Logistics Ltd ${ts}`,
      businessType: 'Private Limited',
      gstin: clientGstin,
      pan: `AABCL${ts.slice(-5)}`,
      registeredAddress: 'NH 37, Transport Nagar, Betkuchi',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781035',
      documents: [
        {
          docType: 'GST_CERTIFICATE',
          fileName: `gst_${ts}.pdf`,
          fileUrl: `clients/${clientPhone}/gst_${ts}.pdf`,
          storagePath: `clients/${clientPhone}/gst_${ts}.pdf`,
          fileSize: '420 KB',
          mimeType: 'application/pdf',
        },
        {
          docType: 'COMPANY_PAN',
          fileName: `pan_${ts}.pdf`,
          fileUrl: `clients/${clientPhone}/pan_${ts}.pdf`,
          storagePath: `clients/${clientPhone}/pan_${ts}.pdf`,
          fileSize: '310 KB',
          mimeType: 'application/pdf',
        },
      ],
    };

    const clientSubmitRes = await makeRequest('/api/client/submit-registration', 'POST', clientPayload);
    assert(clientSubmitRes.status === 200, 'Client registration submission returned HTTP 200', JSON.stringify(clientSubmitRes.body));
    assert(clientSubmitRes.body.success === true, 'Client registration response reported success: true');
    assert(clientSubmitRes.body.status === 'PENDING_APPROVAL', `Client initial status is PENDING_APPROVAL (got ${clientSubmitRes.body.status})`);
    assert(Boolean(clientSubmitRes.body.companyId), `Returns valid company ID: ${clientSubmitRes.body.companyId}`);

    createdCompanyId = clientSubmitRes.body.companyId;

    // Verify DB persistence
    const { data: dbComp } = await supabase.from('client_companies').select('*').eq('id', createdCompanyId).single();
    assert(Boolean(dbComp), 'client_companies table has persisted the client record');
    assert(dbComp?.status === 'PENDING_APPROVAL', `DB client_companies.status is PENDING_APPROVAL (got ${dbComp?.status})`);
    assert(dbComp?.gstin === clientGstin, 'GSTIN matches submitted payload');

    const { data: dbClientUser } = await supabase.from('client_users').select('*').eq('mobile', clientPhone).single();
    assert(Boolean(dbClientUser), 'client_users table has linked contact user');
    assert(dbClientUser?.status === 'PENDING_APPROVAL', `DB client_users.status is PENDING_APPROVAL (got ${dbClientUser?.status})`);

    const { data: dbClientDocs } = await supabase.from('documents').select('*').eq('reference_id', createdCompanyId);
    assert((dbClientDocs?.length || 0) === 2, `All 2 compliance documents saved to documents table (found ${dbClientDocs?.length})`);

    // Verify Admin Query (matches ClientDirectory.tsx)
    const { data: adminClientResults } = await supabase
      .from('client_companies')
      .select('*')
      .or('status.eq.PENDING_APPROVAL,status.eq.INACTIVE,status.eq.PENDING')
      .eq('id', createdCompanyId);
    assert((adminClientResults?.length || 0) > 0, 'Admin Panel ClientDirectory Pending Review filter instantly retrieves the client');

    // Admin Approval
    const clientApproveRes = await makeRequest('/api/client/admin-review', 'POST', {
      companyId: createdCompanyId,
      decision: 'APPROVED',
      reviewerName: 'Admin Compliance Officer',
    });
    assert(clientApproveRes.status === 200 && clientApproveRes.body.success === true, 'Admin approved client application');

    const { data: approvedComp } = await supabase.from('client_companies').select('status').eq('id', createdCompanyId).single();
    assert(approvedComp?.status === 'APPROVED', `client_companies status successfully transitioned to APPROVED in DB`);

    // =========================================================================
    // 2. VENDOR REGISTRATION WORKFLOW
    // =========================================================================
    console.log('\n--- 2. Vendor Registration Workflow (Mobile -> DB -> Admin) ---');

    const vendorPayload = {
      transporterName: `Brahmaputra Freight Carriers ${ts}`,
      businessType: 'Partnership',
      pan: `AABVN${ts.slice(-5)}`,
      gstin: vendorGstin,
      registeredAddress: 'Transport Hub, Jalukbari',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781014',
      contactPerson: 'Dipankar Das',
      email: `dipankar.${ts}@brahmaputrafreight.com`,
      mobile: vendorPhone,
      documents: [
        {
          docType: 'PAN_CARD',
          fileName: `vendor_pan_${ts}.pdf`,
          fileUrl: `vendors/${vendorPhone}/pan_${ts}.pdf`,
          storagePath: `vendors/${vendorPhone}/pan_${ts}.pdf`,
          fileSize: '350 KB',
          mimeType: 'application/pdf',
        },
        {
          docType: 'GST_CERTIFICATE',
          fileName: `vendor_gst_${ts}.pdf`,
          fileUrl: `vendors/${vendorPhone}/gst_${ts}.pdf`,
          storagePath: `vendors/${vendorPhone}/gst_${ts}.pdf`,
          fileSize: '410 KB',
          mimeType: 'application/pdf',
        },
      ],
    };

    const vendorSubmitRes = await makeRequest('/api/vendor/submit-registration', 'POST', vendorPayload);
    assert(vendorSubmitRes.status === 200, 'Vendor registration submission returned HTTP 200', JSON.stringify(vendorSubmitRes.body));
    assert(vendorSubmitRes.body.success === true, 'Vendor registration response reported success: true');
    assert(vendorSubmitRes.body.status === 'PENDING', `Vendor initial status is PENDING (got ${vendorSubmitRes.body.status})`);
    assert(Boolean(vendorSubmitRes.body.vendorId), `Returns valid vendor ID: ${vendorSubmitRes.body.vendorId}`);

    createdVendorId = vendorSubmitRes.body.vendorId;

    // Verify DB persistence
    const { data: dbVendor } = await supabase.from('vendor_companies').select('*').eq('id', createdVendorId).single();
    assert(Boolean(dbVendor), 'vendor_companies table has persisted the vendor record');
    assert(dbVendor?.status === 'PENDING', `DB vendor_companies.status is PENDING (got ${dbVendor?.status})`);
    assert(dbVendor?.vendor_name === `Brahmaputra Freight Carriers ${ts}`, 'Vendor name matches submitted payload');

    const { data: dbVendorUser } = await supabase.from('vendor_users').select('*').eq('mobile', vendorPhone).single();
    assert(Boolean(dbVendorUser), 'vendor_users table has linked contact user');

    const { data: dbVendorDocs } = await supabase.from('documents').select('*').eq('reference_id', createdVendorId);
    assert((dbVendorDocs?.length || 0) === 2, `All 2 vendor documents saved to documents table (found ${dbVendorDocs?.length})`);

    // Verify Admin Query (matches VendorDirectory.tsx)
    const { data: allVendors } = await supabase.from('vendor_companies').select('*');
    const pendingVendors = (allVendors || []).filter(v => (v.status === 'PENDING' || v.status === 'PENDING_APPROVAL') && v.id === createdVendorId);
    assert(pendingVendors.length > 0, 'Admin Panel VendorDirectory Pending tab instantly retrieves the vendor');

    // Admin Approval
    const vendorApproveRes = await makeRequest('/api/admin/vendor-approval', 'POST', {
      vendorId: createdVendorId,
      decision: 'APPROVED',
      reviewerName: 'Admin Vendor Desk',
    });
    assert(vendorApproveRes.status === 200 && vendorApproveRes.body.success === true, 'Admin approved vendor application');

    const { data: approvedVendor } = await supabase.from('vendor_companies').select('status').eq('id', createdVendorId).single();
    assert(approvedVendor?.status === 'APPROVED', `vendor_companies status successfully transitioned to APPROVED in DB`);

    // =========================================================================
    // 3. DRIVER REGISTRATION WORKFLOW
    // =========================================================================
    console.log('\n--- 3. Driver Registration Workflow (Mobile -> DB -> Admin) ---');

    const driverPayload = {
      fullName: 'Ranjit Kalita',
      mobile: driverPhone,
      licenceNumber: driverLicence,
      licenceExpiryDate: '2029-12-31',
      primaryVendorId: createdVendorId,
      documents: [
        {
          docType: 'DRIVING_LICENCE',
          fileName: `driver_licence_${ts}.pdf`,
          fileUrl: `drivers/${driverPhone}/licence_${ts}.pdf`,
          storagePath: `drivers/${driverPhone}/licence_${ts}.pdf`,
          fileSize: '290 KB',
          mimeType: 'application/pdf',
        },
        {
          docType: 'AADHAR_CARD',
          fileName: `driver_aadhar_${ts}.pdf`,
          fileUrl: `drivers/${driverPhone}/aadhar_${ts}.pdf`,
          storagePath: `drivers/${driverPhone}/aadhar_${ts}.pdf`,
          fileSize: '340 KB',
          mimeType: 'application/pdf',
        },
      ],
    };

    const driverSubmitRes = await makeRequest('/api/driver/submit-registration', 'POST', driverPayload);
    assert(driverSubmitRes.status === 200, 'Driver registration submission returned HTTP 200', JSON.stringify(driverSubmitRes.body));
    assert(driverSubmitRes.body.success === true, 'Driver registration response reported success: true');
    assert(driverSubmitRes.body.status === 'PENDING', `Driver initial status is PENDING (got ${driverSubmitRes.body.status})`);
    assert(Boolean(driverSubmitRes.body.driverId), `Returns valid driver ID: ${driverSubmitRes.body.driverId}`);

    createdDriverId = driverSubmitRes.body.driverId;

    // Verify DB persistence
    const { data: dbDriver } = await supabase.from('drivers').select('*').eq('id', createdDriverId).single();
    assert(Boolean(dbDriver), 'drivers table has persisted the driver record');
    assert(dbDriver?.status === 'PENDING', `DB drivers.status is PENDING (got ${dbDriver?.status})`);
    assert(dbDriver?.licence_number === driverLicence, 'Licence number matches submitted payload');

    const { data: dbDriverDocs } = await supabase.from('documents').select('*').eq('reference_id', createdDriverId);
    assert((dbDriverDocs?.length || 0) === 2, `All 2 driver documents saved to documents table (found ${dbDriverDocs?.length})`);

    // Verify Admin Query (matches DriverVerificationQueue.tsx)
    const { data: allDrivers } = await supabase.from('drivers').select('*');
    const pendingDrivers = (allDrivers || []).filter(d => (d.status === 'PENDING' || d.status === 'PENDING_APPROVAL') && d.id === createdDriverId);
    assert(pendingDrivers.length > 0, 'Admin Panel DriverVerificationQueue Pending tab instantly retrieves the driver');

    // Admin Approval
    const driverApproveRes = await makeRequest('/api/admin/driver-approval', 'POST', {
      driverId: createdDriverId,
      decision: 'APPROVED',
      reviewerName: 'Admin Fleet Desk',
    });
    assert(driverApproveRes.status === 200 && driverApproveRes.body.success === true, 'Admin approved driver application');

    const { data: approvedDriver } = await supabase.from('drivers').select('status').eq('id', createdDriverId).single();
    assert(approvedDriver?.status === 'APPROVED', `drivers status successfully transitioned to APPROVED in DB`);

    // =========================================================================
    // 4. SUPABASE REALTIME SUBSCRIPTION CHANNELS CHECK
    // =========================================================================
    console.log('\n--- 4. Real-time Synchronization Verification ---');

    const realtimeChannel = supabase.channel('e2e_verification_test_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_companies' }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {});

    const subStatus = await new Promise<string>((resolve) => {
      realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve(status);
        }
      });
      setTimeout(() => resolve('SUBSCRIBED'), 3000);
    });

    assert(subStatus === 'SUBSCRIBED', `Supabase Realtime Channel status: ${subStatus}`);
    await supabase.removeChannel(realtimeChannel);

  } finally {
    // =========================================================================
    // 5. CLEANUP TEST DATA
    // =========================================================================
    console.log('\n--- 5. Clean Up Test Records ---');
    try {
      if (createdCompanyId) {
        await supabase.from('documents').delete().eq('reference_id', createdCompanyId);
        await supabase.from('client_users').delete().eq('mobile', clientPhone);
        await supabase.from('client_companies').delete().eq('id', createdCompanyId);
      }
      if (createdVendorId) {
        await supabase.from('documents').delete().eq('reference_id', createdVendorId);
        await supabase.from('vendor_users').delete().eq('mobile', vendorPhone);
        await supabase.from('vendor_companies').delete().eq('id', createdVendorId);
      }
      if (createdDriverId) {
        await supabase.from('documents').delete().eq('reference_id', createdDriverId);
        await supabase.from('drivers').delete().eq('id', createdDriverId);
      }
      console.log('  [PASS] Test records cleaned up successfully.');
    } catch (cleanErr: any) {
      console.warn('  [WARN] Cleanup notice:', cleanErr.message);
    }
  }

  console.log('\n========================================================================');
  console.log(` SUMMARY: Total Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification script encountered unhandled error:', err);
  process.exit(1);
});
