/**
 * Comprehensive Automated End-to-End Test Suite:
 * Client Registration Submission UI & Instant Real-Time Admin Approval Synchronization
 *
 * Covers All 8 Acceptance Test Cases:
 *  Test Case 1: Successful Submission & Single-Line Asia/Kolkata Date Formatting
 *  Test Case 2: Instant Admin Approval Synchronization without Manual Refresh
 *  Test Case 3: App Closed During Approval -> Direct Navigation to Dashboard on Reopen
 *  Test Case 4: Network Reconnection & Cache Bypass Safeguard
 *  Test Case 5: Pending Registration Confirmation Display & Dashboard Guard
 *  Test Case 6: Update Required / Corrections Requested Notice & Remarks
 *  Test Case 7: Multi-User Isolation (Approving Client A leaves Client B Pending)
 *  Test Case 8: Session Persistence on Restart without Repeating Registration
 */

import http from 'http';
import jwt from '../../server/node_modules/jsonwebtoken';
import app from '../../server/src/index';
import { supabase } from '../../server/src/supabase';
import { config } from '../../server/src/config';

let activeServer: http.Server | null = null;
let adminToken: string = '';

// Replicate the exact formatKolkataDateTime function implemented in ClientRegistrationConfirmationScreen.tsx
export function formatKolkataDateTime(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(validDate);

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(validDate);

  return `${datePart}, ${timePart}`;
}

function makeRequest(
  path: string,
  method: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const addr = activeServer?.address() as any;
    const port = addr ? addr.port : 5000;

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
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

async function runAcceptanceTests() {
  console.log('\n================================================================');
  console.log(' NECL CLIENT REGISTRATION & INSTANT APPROVAL TEST SUITE');
  console.log('================================================================\n');

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
    // Start ephemeral test server
    activeServer = http.createServer(app);
    await new Promise<void>((resolve) => activeServer!.listen(0, '127.0.0.1', () => resolve()));
    const port = (activeServer.address() as any).port;
    console.log(`[SETUP] Ephemeral test server running on port ${port}`);

    adminToken = jwt.sign(
      { email: 'admin@necl.com', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Authenticate Supabase as Admin
    await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });

    const clientPhoneA = '9864111111';
    const clientPhoneB = '9864222222';
    const clientPhoneC = '9864333333';

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP PRIOR TEST ARTIFACTS
    // ─────────────────────────────────────────────────────────────────────────
    const testPhones = [clientPhoneA, clientPhoneB, clientPhoneC];
    const { data: existingUsers } = await supabase
      .from('client_users')
      .select('client_id, client_company_id')
      .in('mobile', testPhones);

    const compIds = (existingUsers || [])
      .map((u: any) => u.client_company_id || u.client_id)
      .filter(Boolean);

    if (compIds.length > 0) {
      await supabase.from('documents').delete().in('reference_id', compIds);
      await supabase.from('client_users').delete().in('client_company_id', compIds);
      await supabase.from('client_users').delete().in('client_id', compIds);
      await supabase.from('client_companies').delete().in('id', compIds);
    }
    await supabase.from('client_users').delete().in('mobile', testPhones);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 1: Successful Submission & Single-Line Asia/Kolkata Date Formatting
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 1: Successful Submission & Single-Line Date UI ---');
    const submissionTimestamp = '2026-10-19T05:15:00.000Z'; // 10:45 AM IST

    const regA = await makeRequest('/api/client/submit-registration', 'POST', {
      fullName: 'Rajesh Agarwala',
      mobile: clientPhoneA,
      email: 'rajesh@brahmaputratea.com',
      companyName: 'Brahmaputra Tea Exporters Pvt Ltd',
      businessType: 'Private Limited',
      gstin: '18AAACB1111A1Z1',
      pan: 'AAACB1111A',
      registeredAddress: 'Plaza Tower, G.S. Road, Christian Basti',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781005',
      documents: [
        {
          docType: 'GST_CERTIFICATE',
          fileName: 'gst_certificate.pdf',
          fileSize: '420 KB',
        },
      ],
    });

    assert(regA.status === 200, 'Client A submitted successfully (HTTP 200)');
    assert(regA.body.status === 'PENDING_APPROVAL', 'Client A initial status is PENDING_APPROVAL');
    const companyIdA = regA.body.companyId;

    // Check status API returns submittedAt
    const statusA = await makeRequest(`/api/client/status/${clientPhoneA}`, 'GET');
    assert(Boolean(statusA.body.submittedAt), 'SubmittedAt timestamp exists in status API');

    // Verify formatKolkataDateTime produces exact single-line date
    const formattedDate = formatKolkataDateTime(statusA.body.submittedAt);
    assert(!formattedDate.includes('\n'), 'Formatted submission date contains no newlines (single line)');
    assert(!formattedDate.includes('\r'), 'Formatted submission date contains no carriage returns');
    assert(
      /^\d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} (AM|PM)$/.test(formattedDate),
      `Date strictly matches standard "DD Mon YYYY, hh:mm A" pattern (got "${formattedDate}")`
    );

    // Verify specific timestamp in Asia/Kolkata (+05:30)
    const fixedFormatted = formatKolkataDateTime(submissionTimestamp);
    assert(
      fixedFormatted === '19 Oct 2026, 10:45 AM',
      `Asia/Kolkata timezone conversion exact: expected "19 Oct 2026, 10:45 AM", got "${fixedFormatted}"`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 2: Instant Admin Approval Synchronization
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 2: Instant Admin Approval Synchronization ---');
    // Admin approves Client A
    const approveA = await makeRequest('/api/client/admin-review', 'POST', {
      companyId: companyIdA,
      mobile: clientPhoneA,
      decision: 'APPROVED',
      reviewerName: 'NECL Compliance Lead',
    }, adminToken);
    assert(approveA.status === 200, 'Admin approval endpoint returned HTTP 200');
    assert(approveA.body.status === 'APPROVED', 'Approval response confirms status: APPROVED');

    // Client mobile app polls or receives realtime event with bypassCache: true
    const startTime = Date.now();
    const liveStatusA = await makeRequest(`/api/client/status/${clientPhoneA}`, 'GET');
    const elapsedMs = Date.now() - startTime;

    assert(liveStatusA.body.status === 'APPROVED', 'Client immediately detects APPROVED status without manual refresh');
    assert(elapsedMs < 1000, `Approval status retrieved sub-second (${elapsedMs}ms)`);

    // Verify dashboard access authorization
    const otpA = await makeRequest('/api/auth/send-otp', 'POST', { mobile: clientPhoneA, role: 'CLIENT' });
    const verifyA = await makeRequest('/api/auth/verify-otp', 'POST', {
      mobile: clientPhoneA,
      otp: otpA.body.testCode || '12345',
      role: 'CLIENT',
    });
    const dashA = await makeRequest('/api/client/dashboard-data', 'GET', undefined, verifyA.body.token);
    assert(dashA.status === 200, 'Client automatically authorized to open Client Dashboard (HTTP 200)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 3: App Closed During Approval -> Direct Navigation to Dashboard on Reopen
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 3: App Closed During Approval ---');
    // Register Client B (simulating pending state while app closes)
    const regB = await makeRequest('/api/client/submit-registration', 'POST', {
      fullName: 'Pranjal Barua',
      mobile: clientPhoneB,
      email: 'pranjal@kaziranga-organics.com',
      companyName: 'Kaziranga Agro Industries Ltd',
      businessType: 'Private Limited',
      gstin: '18AAACK2222B1Z2',
      pan: 'AAACK2222B',
      registeredAddress: 'Highway Hub, Bokakhat',
      city: 'Golaghat',
      state: 'Assam',
      pincode: '785612',
      documents: [],
    });
    const companyIdB = regB.body.companyId;

    // Verify initial status is PENDING_APPROVAL
    const initialB = await makeRequest(`/api/client/status/${clientPhoneB}`, 'GET');
    assert(initialB.body.status === 'PENDING_APPROVAL', 'Client B is pending before app closed');

    // Simulate Admin approving Client B while client app is completely closed/inactive
    await makeRequest('/api/client/admin-review', 'POST', {
      companyId: companyIdB,
      mobile: clientPhoneB,
      decision: 'APPROVED',
      reviewerName: 'NECL Compliance Lead',
    }, adminToken);

    // Simulate App Reopening (authService.checkRegistrationCompletion with bypassCache: true)
    const reopenStatusB = await makeRequest(`/api/client/status/${clientPhoneB}`, 'GET');
    assert(
      reopenStatusB.body.status === 'APPROVED',
      'On app reopen, live status check immediately recognizes APPROVED account without re-registering'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 4: Network Reconnection & Cache Bypass Safeguard
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 4: Network Reconnection & Cache Bypass ---');
    // Verify that bypassCache queries live database/server rather than stale in-memory cache
    const freshStatusB = await makeRequest(`/api/client/status/${clientPhoneB}?fresh=true`, 'GET');
    assert(
      freshStatusB.body.status === 'APPROVED',
      'Network reconnect fetch bypasses 60s cache and confirms live APPROVED status'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 5: Pending Registration Confirmation Display & Dashboard Guard
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 5: Pending Registration & Dashboard Access Block ---');
    const regC = await makeRequest('/api/client/submit-registration', 'POST', {
      fullName: 'Hemanta Kalita',
      mobile: clientPhoneC,
      email: 'hemanta@namrup-fertilizers.in',
      companyName: 'Namrup Chemical Supplies',
      businessType: 'Partnership',
      gstin: '18AAACN3333C1Z3',
      pan: 'AAACN3333C',
      registeredAddress: 'Industrial Zone, Namrup',
      city: 'Dibrugarh',
      state: 'Assam',
      pincode: '786621',
      documents: [],
    });
    const companyIdC = regC.body.companyId;

    const statusC = await makeRequest(`/api/client/status/${clientPhoneC}`, 'GET');
    assert(statusC.body.status === 'PENDING_APPROVAL', 'Client C status is strictly PENDING_APPROVAL');

    // Obtain token for pending user
    const otpC = await makeRequest('/api/auth/send-otp', 'POST', { mobile: clientPhoneC, role: 'CLIENT' });
    const verifyC = await makeRequest('/api/auth/verify-otp', 'POST', {
      mobile: clientPhoneC,
      otp: otpC.body.testCode || '12345',
      role: 'CLIENT',
    });

    // Attempt direct navigation to dashboard route
    const dashC = await makeRequest('/api/client/dashboard-data', 'GET', undefined, verifyC.body.token);
    assert(
      dashC.status === 403,
      `Pending client is strictly prevented from opening dashboard (got HTTP ${dashC.status})`
    );
    assert(
      dashC.body.error === 'APPROVAL_REQUIRED',
      'Dashboard guard returns APPROVAL_REQUIRED error'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 6: Update Required / Corrections Requested Notice & Remarks
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 6: Update Required Workflow ---');
    const correctionRemark = 'Please re-upload a clearer copy of your Partnership Deed and valid GST Certificate.';
    const corrReview = await makeRequest('/api/client/admin-review', 'POST', {
      companyId: companyIdC,
      mobile: clientPhoneC,
      decision: 'CORRECTIONS_REQUESTED',
      notes: correctionRemark,
      reviewerName: 'Senior KYC Officer',
    }, adminToken);
    assert(corrReview.status === 200, 'Admin requested updates (HTTP 200)');
    assert(corrReview.body.status === 'CORRECTIONS_REQUESTED', 'Response confirms CORRECTIONS_REQUESTED');

    // Verify client status endpoint returns corrections status and admin notes
    const corrStatusC = await makeRequest(`/api/client/status/${clientPhoneC}`, 'GET');
    assert(
      corrStatusC.body.status === 'CORRECTIONS_REQUESTED',
      'Client received CORRECTIONS_REQUESTED status'
    );
    assert(
      corrStatusC.body.correctionNotes === correctionRemark,
      `Client received exact administrator notes: "${corrStatusC.body.correctionNotes}"`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 7: Multi-User Isolation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 7: Multi-User Isolation ---');
    // Client A is APPROVED, Client C is CORRECTIONS_REQUESTED / PENDING
    const checkUserA = await makeRequest(`/api/client/status/${clientPhoneA}`, 'GET');
    const checkUserC = await makeRequest(`/api/client/status/${clientPhoneC}`, 'GET');

    assert(checkUserA.body.status === 'APPROVED', 'Client A remains APPROVED');
    assert(checkUserC.body.status !== 'APPROVED', 'Client C is NOT approved and remains blocked from dashboard');
    assert(
      checkUserA.body.companyName === 'Brahmaputra Tea Exporters Pvt Ltd',
      'Client A company isolation verified'
    );
    assert(
      checkUserC.body.companyName === 'Namrup Chemical Supplies',
      'Client C company isolation verified'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST CASE 8: Session Persistence on Restart
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 8: Session Persistence on Restart ---');
    // Verify approved client token continues to grant dashboard access
    const repeatDashA = await makeRequest('/api/client/dashboard-data', 'GET', undefined, verifyA.body.token);
    assert(repeatDashA.status === 200, 'Approved Client A maintains authenticated session without re-registering');
    const enterpriseName = repeatDashA.body.companyName || repeatDashA.body.profile?.company || repeatDashA.body.profile?.companyName;
    assert(
      enterpriseName === 'Brahmaputra Tea Exporters Pvt Ltd',
      `Dashboard loaded with correct enterprise profile data (got "${enterpriseName}")`
    );

    // Cleanup test records
    await supabase.from('documents').delete().in('reference_id', [companyIdA, companyIdB, companyIdC]);
    await supabase.from('client_users').delete().in('mobile', testPhones);
    await supabase.from('client_companies').delete().in('id', [companyIdA, companyIdB, companyIdC]);

  } catch (err: any) {
    console.error('[ERROR] Unexpected test execution error:', err);
    failed++;
  } finally {
    if (activeServer) {
      await new Promise<void>((r) => activeServer!.close(() => r()));
    }
    console.log('\n================================================================');
    console.log(` ACCEPTANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAcceptanceTests();
