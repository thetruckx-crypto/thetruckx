/**
 * End-to-End Verification Script:
 * Client Registration Visibility, Real-Time Synchronization, Admin Approval & Rejection Flow
 *
 * Verifies:
 * 1. Mobile app client registration submission with business details and documents.
 * 2. Instant visibility in Admin Panel without page refresh (real database query & RLS check).
 * 3. Prevention of duplicate tables or client records.
 * 4. Admin rejection workflow requiring mandatory rejection reason.
 * 5. Instant synchronization of rejection status and reason to mobile client.
 * 6. Admin approval workflow with instant update in database.
 * 7. Mobile client automatic recognition of approval and authorization for dashboard access.
 * 8. Supabase Realtime channel connectivity.
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

async function runTests() {
  console.log('\n================================================================');
  console.log(' NECL CLIENT REGISTRATION, REALTIME SYNC & ADMIN APPROVAL TESTS');
  console.log('================================================================\n');

  console.log(`[INFO] Targeting live backend service on port ${SERVER_PORT}`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(` [PASS] ${testName}`);
      passed++;
    } else {
      console.error(` [FAIL] ${testName}`);
      if (detail) console.error(`        Detail: ${detail}`);
      failed++;
    }
  }

  try {
    // Authenticate Supabase as Admin
    await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

    const testMobile = '9864012345';
    const testMobile2 = '9864099999';

    // Idempotent cleanup before test run
    await supabase.from('documents').delete().in('file_name', [
      'GST_CERTIFICATE: gst_certificate_assam_tea.pdf',
      'COMPANY_PAN: pan_card_assam_tea.pdf',
      'INCORPORATION_PROOF: incorporation_assam_tea.pdf',
    ]);
    const { data: existingCompList } = await supabase
      .from('client_companies')
      .select('id')
      .in('gstin', ['18AABCA1234F1Z1', '17AAACM5678Q1Z2']);
    if (existingCompList && existingCompList.length > 0) {
      const cIds = existingCompList.map((c: any) => c.id);
      const { data: reqs } = await supabase.from('requirements').select('id').in('client_id', cIds);
      const rIds = (reqs || []).map((r: any) => r.id);
      if (rIds.length > 0) {
        const { data: bks } = await supabase.from('bookings').select('id').in('requirement_id', rIds);
        const bIds = (bks || []).map((b: any) => b.id);
        if (bIds.length > 0) {
          await supabase.from('trips').delete().in('booking_id', bIds);
          await supabase.from('bookings').delete().in('id', bIds);
        }
        await supabase.from('requirements').delete().in('id', rIds);
      }
      await supabase.from('documents').delete().in('reference_id', cIds);
      await supabase.from('client_users').delete().in('client_company_id', cIds);
      await supabase.from('client_users').delete().in('client_id', cIds);
      await supabase.from('client_companies').delete().in('id', cIds);
    }
    await supabase.from('client_users').delete().in('mobile', [testMobile, testMobile2]);
    await supabase.from('client_companies').delete().in('gstin', ['18AABCA1234F1Z1', '17AAACM5678Q1Z2']);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Client Registration Submission from Mobile App (Task 1)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 1: Submit Client Registration via Mobile App API ---');
    const regPayload = {
      fullName: 'Bhabesh Sharma',
      mobile: testMobile,
      companyPhone: testMobile,
      email: 'bhabesh@assamtea-logistics.in',
      designation: 'Managing Director',
      department: 'Logistics Operations',
      companyName: 'Assam Green Tea Logistics Ltd',
      businessType: 'Private Limited',
      gstin: '18AABCA1234F1Z1',
      pan: 'AABCA1234F',
      registeredAddress: 'NH 37, Industrial Growth Centre, Amingaon',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781034',
      documents: [
        {
          docType: 'GST_CERTIFICATE',
          fileName: 'gst_certificate_assam_tea.pdf',
          fileUrl: 'clients/9864012345/gst_certificate_assam_tea.pdf',
          storagePath: 'clients/9864012345/gst_certificate_assam_tea.pdf',
          fileSize: '450 KB',
          mimeType: 'application/pdf',
        },
        {
          docType: 'COMPANY_PAN',
          fileName: 'pan_card_assam_tea.pdf',
          fileUrl: 'clients/9864012345/pan_card_assam_tea.pdf',
          storagePath: 'clients/9864012345/pan_card_assam_tea.pdf',
          fileSize: '320 KB',
          mimeType: 'application/pdf',
        },
        {
          docType: 'INCORPORATION_PROOF',
          fileName: 'incorporation_assam_tea.pdf',
          fileUrl: 'clients/9864012345/incorporation_assam_tea.pdf',
          storagePath: 'clients/9864012345/incorporation_assam_tea.pdf',
          fileSize: '890 KB',
          mimeType: 'application/pdf',
        },
      ],
    };

    const regRes = await makeRequest('/api/client/submit-registration', 'POST', regPayload);
    assert(regRes.status === 200, 'Registration API returns HTTP 200', JSON.stringify(regRes.body));
    assert(regRes.body.success === true, 'Registration reports success: true');
    assert(regRes.body.status === 'PENDING_APPROVAL', 'Initial registration status is PENDING_APPROVAL');
    assert(Boolean(regRes.body.companyId), 'Returns valid companyId UUID');
    assert(Boolean(regRes.body.clientCode), `Returns formatted clientCode: ${regRes.body.clientCode}`);

    const companyId = regRes.body.companyId;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Database Persistence & Visibility in Admin Panel (Task 1 & 3)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 2: Verify Database Storage & Admin Visibility ---');

    // 2a. Check client_companies table
    const { data: dbComp, error: compErr } = await supabase
      .from('client_companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    assert(!compErr && Boolean(dbComp), 'client_companies record exists in Supabase');
    assert(dbComp?.status === 'PENDING_APPROVAL', `Company status in database is PENDING_APPROVAL (got ${dbComp?.status})`);
    assert(dbComp?.company_name === 'Assam Green Tea Logistics Ltd', 'Company name accurately stored');
    assert(dbComp?.gstin === '18AABCA1234F1Z1', 'GSTIN accurately stored');
    assert(dbComp?.city === 'Guwahati', 'City accurately stored');

    // 2b. Check client_users table (primary contact)
    const { data: dbUser, error: userErr } = await supabase
      .from('client_users')
      .select('*')
      .eq('mobile', testMobile)
      .maybeSingle();

    assert(!userErr && Boolean(dbUser), 'client_users record exists for contact');
    assert(dbUser?.full_name === 'Bhabesh Sharma', 'Contact full name accurately stored');
    assert(dbUser?.client_id === companyId || dbUser?.client_company_id === companyId, 'User correctly linked to company');

    // 2c. Check compliance documents stored under valid constraints
    const { data: dbDocs, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('reference_id', companyId);

    assert(!docErr && Boolean(dbDocs), 'documents query succeeded');
    assert(dbDocs?.length === 3, `All 3 compliance documents attached (found ${dbDocs?.length})`);
    const docTypesFound = dbDocs?.map(d => d.file_name) || [];
    assert(
      docTypesFound.some(f => f.includes('GST_CERTIFICATE')),
      'GST certificate stored with reference'
    );
    assert(
      docTypesFound.some(f => f.includes('COMPANY_PAN')),
      'PAN card document stored with reference'
    );

    // 2d. Check Admin Panel's Pending Approvals Query
    const { data: adminPending, error: pendingErr } = await supabase
      .from('client_companies')
      .select('id, company_name, status')
      .or('status.eq.PENDING_APPROVAL,status.eq.INACTIVE,status.eq.PENDING');

    assert(!pendingErr, 'Admin Panel pending query executed without database errors');
    const foundInPending = (adminPending || []).some(c => c.id === companyId);
    assert(foundInPending, 'Newly submitted client appears in Admin Panel Pending Approvals query');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Prevention of Duplicate Records (Task 1 requirement)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 3: Verify Zero Record Duplication on Resubmission ---');
    // Resubmit with updated contact name
    const resubmitPayload = { ...regPayload, fullName: 'Bhabesh Sharma (Updated)' };
    const resubmitRes = await makeRequest('/api/client/submit-registration', 'POST', resubmitPayload);
    assert(resubmitRes.status === 200, 'Resubmission returns HTTP 200');

    // Verify company count for this GSTIN
    const { count: companyCount } = await supabase
      .from('client_companies')
      .select('id', { count: 'exact', head: true })
      .eq('gstin', '18AABCA1234F1Z1');

    assert(companyCount === 1, `Exactly 1 company record exists for GSTIN (no duplicates, count = ${companyCount})`);

    // Verify user count for this mobile
    const { count: userCount } = await supabase
      .from('client_users')
      .select('id', { count: 'exact', head: true })
      .eq('mobile', testMobile);

    assert(userCount === 1, `Exactly 1 client_users record exists for mobile (no duplicates, count = ${userCount})`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Live Status Check & Security Guard (Task 4 & 5)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 4: Verify Live Status Endpoint & Dashboard Protection ---');
    const statusRes = await makeRequest(`/api/client/status/${testMobile}`, 'GET');
    assert(statusRes.status === 200, 'GET /api/client/status returns HTTP 200');
    assert(statusRes.body.status === 'PENDING_APPROVAL', 'Live status accurately returns PENDING_APPROVAL');
    assert(statusRes.body.companyName === 'Assam Green Tea Logistics Ltd', 'Live status returns correct company name');

    // Test protected dashboard endpoint: must block unapproved client with 403
    // Simulate client requesting token before admin approval
    const otpReq = await makeRequest('/api/auth/send-otp', 'POST', { mobile: testMobile, role: 'CLIENT' });
    assert(otpReq.status === 200, 'OTP request succeeded for registered phone');
    const otpVerify = await makeRequest('/api/auth/verify-otp', 'POST', {
      mobile: testMobile,
      otp: otpReq.body.testCode || '12345',
      role: 'CLIENT',
    });
    assert(otpVerify.status === 200, 'OTP verified successfully');
    const clientToken = otpVerify.body.token;

    // Attempt to access protected dashboard data with token
    const dashRes = await makeRequest('/api/client/dashboard-data', 'GET', undefined, clientToken);
    assert(
      dashRes.status === 403,
      `Protected Dashboard API denies access to unapproved client (HTTP ${dashRes.status})`
    );
    assert(
      dashRes.body.error === 'APPROVAL_REQUIRED',
      'Denial error is APPROVAL_REQUIRED (access strictly guarded)'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Admin Client Rejection Workflow (Task 3 & 4)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 5: Test Admin Rejection with Mandatory Reason ---');

    // Register a second client for rejection test
    const rejPayload = {
      fullName: 'Vikram Singha',
      mobile: testMobile2,
      companyPhone: testMobile2,
      email: 'vikram@meghalayacoal.in',
      designation: 'Director',
      department: 'Logistics',
      companyName: 'Meghalaya Coal & Aggregates Ltd',
      businessType: 'Private Limited',
      gstin: '17AAACM5678Q1Z2',
      pan: 'AAACM5678Q',
      registeredAddress: 'GS Road, Khanapara',
      city: 'Shillong',
      state: 'Meghalaya',
      pincode: '793001',
      documents: [],
    };
    const regRes2 = await makeRequest('/api/client/submit-registration', 'POST', rejPayload);
    assert(regRes2.status === 200, 'Second client registration submitted');
    const companyId2 = regRes2.body.companyId;

    // 5a. Admin attempts rejection without a reason -> Must Fail
    const emptyRejectRes = await makeRequest('/api/client/admin-review', 'POST', {
      companyId: companyId2,
      mobile: testMobile2,
      decision: 'REJECTED',
      reason: '   ', // Blank reason
    });
    assert(
      emptyRejectRes.status === 400,
      `Rejection without reason is rejected with HTTP 400 (got ${emptyRejectRes.status})`
    );

    // 5b. Admin rejects with valid mandatory reason
    const mandatoryReason = 'GSTIN registration cancelled in official GST portal. Please submit active GST certificate.';
    const rejectRes = await makeRequest('/api/client/admin-review', 'POST', {
      companyId: companyId2,
      mobile: testMobile2,
      decision: 'REJECTED',
      reason: mandatoryReason,
      reviewerName: 'NECL Head Compliance Officer',
    });
    assert(rejectRes.status === 200, 'Admin rejection succeeded with valid reason');
    assert(rejectRes.body.status === 'REJECTED', 'Returned status is REJECTED');

    // 5c. Verify database immediately reflects rejection and reason
    const { data: rejComp } = await supabase
      .from('client_companies')
      .select('status, rejection_reason')
      .eq('id', companyId2)
      .single();
    assert(rejComp?.status === 'REJECTED', `Database status updated to REJECTED (got ${rejComp?.status})`);
    assert(rejComp?.rejection_reason === mandatoryReason, 'Database contains exact rejection reason');

    // 5d. Verify client status endpoint reflects rejection immediately for mobile app
    const statusRejRes = await makeRequest(`/api/client/status/${testMobile2}`, 'GET');
    assert(statusRejRes.status === 200, 'Mobile status check for rejected client returns HTTP 200');
    assert(statusRejRes.body.status === 'REJECTED', 'Mobile receives status: REJECTED');
    assert(statusRejRes.body.rejectionReason === mandatoryReason, 'Mobile receives exact rejection reason');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Admin Client Approval Workflow (Task 3 & 4)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 6: Test Admin Approval Workflow ---');

    const approveRes = await makeRequest('/api/client/admin-review', 'POST', {
      companyId,
      mobile: testMobile,
      decision: 'APPROVED',
      reviewerName: 'NECL Head Compliance Officer',
    });
    assert(approveRes.status === 200, 'Admin approval returns HTTP 200');
    assert(approveRes.body.status === 'APPROVED', 'Approval returns status: APPROVED');

    // 6a. Verify database reflects APPROVED status
    const { data: appComp } = await supabase
      .from('client_companies')
      .select('status, approved_at, approved_by')
      .eq('id', companyId)
      .single();
    assert(appComp?.status === 'APPROVED', `Database company status is APPROVED (got ${appComp?.status})`);
    assert(Boolean(appComp?.approved_at), 'approved_at timestamp set');
    assert(appComp?.approved_by === 'NECL Head Compliance Officer', 'approved_by recorded');

    // 6b. Verify client_users status updated to ACTIVE
    const { data: appUser } = await supabase
      .from('client_users')
      .select('status')
      .eq('mobile', testMobile)
      .single();
    assert(appUser?.status === 'ACTIVE', `Primary contact status updated to ACTIVE (got ${appUser?.status})`);

    // 6c. Verify mobile status endpoint reflects approval instantly
    const liveAppRes = await makeRequest(`/api/client/status/${testMobile}`, 'GET');
    assert(liveAppRes.status === 200, 'Mobile status endpoint returns HTTP 200');
    assert(liveAppRes.body.status === 'APPROVED', 'Mobile status endpoint returns status: APPROVED');

    // 6d. Verify approved client now has dashboard access unlocked
    const approvedDashRes = await makeRequest('/api/client/dashboard-data', 'GET', undefined, clientToken);
    assert(
      approvedDashRes.status === 200,
      `Protected Dashboard API now grants access to approved client (HTTP 200)`
    );
    assert(
      approvedDashRes.body.status === 'APPROVED',
      'Dashboard welcome response received'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 7: Supabase Realtime Subscription Verification (Task 2)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 7: Verify Supabase Realtime Channel Subscription ---');
    let realtimeConnected = false;

    const channel = supabase
      .channel('test-verification-client-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_companies' }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_users' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          realtimeConnected = true;
        }
      });

    // Wait up to 3 seconds for realtime connection
    await new Promise((r) => setTimeout(r, 2000));
    supabase.removeChannel(channel);

    assert(realtimeConnected, 'Supabase Realtime channel connected and in SUBSCRIBED state');

  } catch (err: any) {
    console.error('[ERROR] Unexpected test execution error:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
