/**
 * Automated Verification Script for Client, Vendor, and Driver Authentication & Validation
 *
 * Validates:
 * 1. Unregistered users are blocked from login (403 Forbidden + exact message)
 * 2. Cross-role mismatch detection (409 Conflict + switch role message)
 * 3. Registered Client, Vendor, Driver direct login flow (OTP request -> verify -> JWT)
 * 4. Protected role dashboard APIs allow matching role and reject unauthenticated or mismatched roles
 * 5. No account duplication occurs on login attempts
 */

import http from 'http';
import jwt from '../../server/node_modules/jsonwebtoken';
import app, { getServerUserRegistry, saveServerUserRegistry } from '../../server/src/index';
import { supabase } from '../../server/src/supabase';
import { config } from '../../server/src/config';

// Helper to make HTTP requests against the Express app
function makeRequest(
  server: http.Server,
  path: string,
  method: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const postData = body ? JSON.stringify(body) : '';

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
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
  console.log('\n=============================================================');
  console.log('🚀 Running Authentication & Registration Validation Test Suite');
  console.log('=============================================================\n');

  // Start express app on an ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  console.log(`[SETUP] Ephemeral test server running on port ${port}`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  try {
    const unregisteredPhone = '9000099999';

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Block Login for Unregistered Users (Client, Vendor, Driver)
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 1: Block Login for Unregistered Users');

    for (const testRole of ['CLIENT', 'VENDOR', 'DRIVER']) {
      // 1a. Check registration endpoint
      const checkRes = await makeRequest(server, '/api/auth/check-registration', 'POST', {
        mobile: unregisteredPhone,
        role: testRole,
      });

      assert(
        checkRes.status === 200 &&
          checkRes.body.isRegistered === false &&
          checkRes.body.status === 'NOT_REGISTERED' &&
          checkRes.body.message === 'You are not registered yet. Please register before logging in.',
        `Check-registration returns NOT_REGISTERED for unregistered ${testRole}`,
        JSON.stringify(checkRes.body)
      );

      // 1b. Block send-otp for LOGIN purpose with 403 Forbidden
      const sendOtpRes = await makeRequest(server, '/api/auth/send-otp', 'POST', {
        mobile: unregisteredPhone,
        role: testRole,
        purpose: 'LOGIN',
      });

      assert(
        sendOtpRes.status === 403 &&
          sendOtpRes.body.success === false &&
          sendOtpRes.body.error === 'NOT_REGISTERED' &&
          sendOtpRes.body.message === 'You are not registered yet. Please register before logging in.',
        `Send-otp strictly blocks unregistered ${testRole} login with 403 Forbidden`,
        JSON.stringify(sendOtpRes.body)
      );

      // 1c. Block verify-otp for LOGIN purpose with 403 Forbidden
      const verifyOtpRes = await makeRequest(server, '/api/auth/verify-otp', 'POST', {
        mobile: unregisteredPhone,
        role: testRole,
        code: '12345',
        purpose: 'LOGIN',
      });

      assert(
        verifyOtpRes.status === 403 &&
          verifyOtpRes.body.success === false &&
          verifyOtpRes.body.error === 'NOT_REGISTERED' &&
          verifyOtpRes.body.message === 'You are not registered yet. Please register before logging in.',
        `Verify-otp strictly blocks unregistered ${testRole} login with 403 Forbidden`,
        JSON.stringify(verifyOtpRes.body)
      );
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Role Mismatch Validation
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 2: Cross-Role Mismatch Detection');

    // Register a vendor user for testing role conflict
    const testConflictPhone = '9111122222';
    const regVendorRes = await makeRequest(server, '/api/auth/register-sync', 'POST', {
      fullName: 'Test Vendor Owner',
      mobile: testConflictPhone,
      role: 'VENDOR',
      companyName: 'Test Vendor Transport',
      status: 'ACTIVE',
    });

    assert(
      regVendorRes.status === 200 && regVendorRes.body.success === true,
      'Test Vendor registered via register-sync'
    );

    // Now attempt to log in as CLIENT using the Vendor's registered mobile
    const conflictCheckRes = await makeRequest(server, '/api/auth/check-registration', 'POST', {
      mobile: testConflictPhone,
      role: 'CLIENT',
    });

    assert(
      conflictCheckRes.status === 200 &&
        conflictCheckRes.body.isRegistered === false &&
        conflictCheckRes.body.isRegisteredOtherRole === true &&
        conflictCheckRes.body.otherRole === 'VENDOR',
      'Check-registration detects cross-role conflict (Vendor attempting to login as Client)',
      JSON.stringify(conflictCheckRes.body)
    );

    const conflictSendRes = await makeRequest(server, '/api/auth/send-otp', 'POST', {
      mobile: testConflictPhone,
      role: 'CLIENT',
      purpose: 'LOGIN',
    });

    assert(
      conflictSendRes.status === 409 &&
        conflictSendRes.body.error === 'WRONG_ROLE' &&
        conflictSendRes.body.registeredRole === 'VENDOR',
      'Send-otp returns 409 Conflict with registeredRole = VENDOR',
      JSON.stringify(conflictSendRes.body)
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Successful Login After Registration for All 3 Roles
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 3: Allow Direct Login After Registration');

    const testUsers = [
      { role: 'CLIENT', phone: '9222233333', name: 'Verified Client Shipper' },
      { role: 'VENDOR', phone: '9333344444', name: 'Verified Vendor Carrier' },
      { role: 'DRIVER', phone: '9444455555', name: 'Verified Heavy Driver' },
    ];

    const tokens: Record<string, string> = {};

    for (const u of testUsers) {
      // 1. Register user
      const regRes = await makeRequest(server, '/api/auth/register-sync', 'POST', {
        fullName: u.name,
        mobile: u.phone,
        role: u.role,
        companyName: `${u.name} Enterprise`,
        status: 'ACTIVE',
      });

      assert(
        regRes.status === 200 && regRes.body.success === true,
        `User registered as ${u.role}`
      );

      // 2. Request OTP for LOGIN
      const sendRes = await makeRequest(server, '/api/auth/send-otp', 'POST', {
        mobile: u.phone,
        role: u.role,
        purpose: 'LOGIN',
      });

      assert(
        sendRes.status === 200 && sendRes.body.success === true,
        `Registered ${u.role} sends OTP successfully`,
        JSON.stringify(sendRes.body)
      );

      // 3. Verify OTP
      const testOtp = sendRes.body.testCode || '12345';
      const verifyRes = await makeRequest(server, '/api/auth/verify-otp', 'POST', {
        mobile: u.phone,
        role: u.role,
        code: testOtp,
        purpose: 'LOGIN',
      });

      assert(
        verifyRes.status === 200 &&
          verifyRes.body.success === true &&
          verifyRes.body.isExistingUser === true &&
          verifyRes.body.role === u.role &&
          Boolean(verifyRes.body.token),
        `Registered ${u.role} logs in directly and receives JWT session token`,
        JSON.stringify(verifyRes.body)
      );

      tokens[u.role] = verifyRes.body.token;
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Backend Security & Role-Based API Protection
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 4: Backend Role-Based Access Control');

    // 4a. Unauthenticated access blocked
    const unauthClient = await makeRequest(server, '/api/client/dashboard-data', 'GET');
    assert(
      unauthClient.status === 401,
      'Unauthenticated request to /api/client/dashboard-data blocked with 401'
    );

    // 4b. Role access validation
    // Client token accessing Client Dashboard
    const clientOk = await makeRequest(server, '/api/client/dashboard-data', 'GET', null, tokens['CLIENT']);
    assert(
      clientOk.status === 200 && clientOk.body.success === true,
      'CLIENT token granted access to /api/client/dashboard-data'
    );

    // Client token attempting to access Vendor Dashboard
    const clientForbidden = await makeRequest(server, '/api/vendor/dashboard-data', 'GET', null, tokens['CLIENT']);
    assert(
      clientForbidden.status === 403 && clientForbidden.body.error === 'ROLE_FORBIDDEN',
      'CLIENT token denied access to /api/vendor/dashboard-data with 403 Forbidden'
    );

    // Vendor token accessing Vendor Dashboard
    const vendorOk = await makeRequest(server, '/api/vendor/dashboard-data', 'GET', null, tokens['VENDOR']);
    assert(
      vendorOk.status === 200 && vendorOk.body.success === true,
      'VENDOR token granted access to /api/vendor/dashboard-data'
    );

    // Driver token accessing Driver Dashboard
    const driverOk = await makeRequest(server, '/api/driver/dashboard-data', 'GET', null, tokens['DRIVER']);
    assert(
      driverOk.status === 200 && driverOk.body.success === true,
      'DRIVER token granted access to /api/driver/dashboard-data'
    );

    // Driver token attempting to access Client Dashboard
    const driverForbidden = await makeRequest(server, '/api/client/dashboard-data', 'GET', null, tokens['DRIVER']);
    assert(
      driverForbidden.status === 403 && driverForbidden.body.error === 'ROLE_FORBIDDEN',
      'DRIVER token denied access to /api/client/dashboard-data with 403 Forbidden'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 5: No Duplicate User Accounts Created During Login Attempts
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 5: Account Duplication Prevention');

    const checkBefore = await makeRequest(server, '/api/auth/check-registration', 'POST', {
      mobile: '9000088888',
      role: 'CLIENT',
    });
    assert(
      checkBefore.body.isRegistered === false,
      'Target mobile is initially unregistered'
    );

    // Attempt multiple logins with unregistered number
    await makeRequest(server, '/api/auth/send-otp', 'POST', { mobile: '9000088888', role: 'CLIENT', purpose: 'LOGIN' });
    await makeRequest(server, '/api/auth/verify-otp', 'POST', { mobile: '9000088888', role: 'CLIENT', code: '12345', purpose: 'LOGIN' });

    const checkAfter = await makeRequest(server, '/api/auth/check-registration', 'POST', {
      mobile: '9000088888',
      role: 'CLIENT',
    });
    assert(
      checkAfter.body.isRegistered === false,
      'Target mobile remains unregistered after failed login attempts (no duplicate account created)'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Registration OTP Verification Separated from Login
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 6: Registration OTP Verification Separated from Login');

    const newClientPhone = '9000077777';
    await supabase.from('client_users').delete().eq('mobile', newClientPhone);
    const registryAfterClean = getServerUserRegistry().filter(u => u.mobile !== newClientPhone);
    saveServerUserRegistry(registryAfterClean);

    // 6a. Dispatch Registration OTP
    const regOtpRes = await makeRequest(server, '/api/auth/send-otp', 'POST', {
      mobile: newClientPhone,
      role: 'CLIENT',
      purpose: 'REGISTRATION',
    });
    assert(
      regOtpRes.status === 200 && regOtpRes.body.success === true,
      'Registration OTP sent successfully for new client'
    );

    // 6b. Verify Registration OTP
    const regVerifyRes = await makeRequest(server, '/api/auth/verify-otp', 'POST', {
      mobile: newClientPhone,
      role: 'CLIENT',
      code: '12345',
      purpose: 'REGISTRATION',
    });
    assert(
      regVerifyRes.status === 200 &&
      regVerifyRes.body.verified === true &&
      !regVerifyRes.body.token,
      'Registration OTP verification marks phone as verified without issuing dashboard JWT token'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Client Admin Approval Flow & Backend Dashboard Guard
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 TEST SUITE 7: Client Admin Approval Flow & Dashboard Guard');

    // 7a. Register new client with PENDING_APPROVAL status
    const syncPendingRes = await makeRequest(server, '/api/auth/register-sync', 'POST', {
      fullName: 'Aarav Logistics',
      mobile: newClientPhone,
      role: 'CLIENT',
      companyName: 'Aarav Tea & Agro Enterprises',
      status: 'PENDING_APPROVAL',
    });
    assert(
      syncPendingRes.status === 200 && syncPendingRes.body.user.status === 'PENDING_APPROVAL',
      'Client registration record created with status PENDING_APPROVAL'
    );

    // 7b. Login as pending client: receives token, but dashboard access is blocked
    const pendingLoginRes = await makeRequest(server, '/api/auth/verify-otp', 'POST', {
      mobile: newClientPhone,
      role: 'CLIENT',
      code: '12345',
      purpose: 'LOGIN',
    });
    assert(
      pendingLoginRes.status === 200 && pendingLoginRes.body.accountStatus === 'PENDING_APPROVAL',
      'Pending client authenticates with accountStatus PENDING_APPROVAL'
    );

    const pendingToken = pendingLoginRes.body.token;

    // 7c. Dashboard access blocked for unapproved client with 403 and clear review message
    const pendingDashboardRes = await makeRequest(server, '/api/client/dashboard-data', 'GET', null, pendingToken);
    assert(
      pendingDashboardRes.status === 403 &&
      pendingDashboardRes.body.error === 'APPROVAL_REQUIRED' &&
      pendingDashboardRes.body.message.includes('under review'),
      'Unapproved client dashboard request blocked with 403 APPROVAL_REQUIRED and under review message'
    );

    // 7d. Admin reviews and approves client (using signed Admin JWT)
    const adminToken = jwt.sign(
      { userId: '00000000-0000-0000-0000-000000000001', email: 'admin@necl.com', role: 'ADMIN', name: 'Chief Compliance Officer' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const adminApproveRes = await makeRequest(
      server,
      '/api/auth/admin-review-client',
      'POST',
      {
        mobile: newClientPhone,
        decision: 'APPROVED',
        reviewerName: 'Chief Compliance Officer',
      },
      adminToken
    );
    assert(
      adminApproveRes.status === 200 && adminApproveRes.body.decision === 'APPROVED',
      'Admin approves client registration via /api/auth/admin-review-client'
    );

    // 7e. After Admin approval, client has full dashboard access
    const approvedDashboardRes = await makeRequest(server, '/api/client/dashboard-data', 'GET', null, pendingToken);
    assert(
      approvedDashboardRes.status === 200 && approvedDashboardRes.body.success === true,
      'Approved client receives full access to /api/client/dashboard-data'
    );

    console.log('\n=============================================================');
    console.log(`🎉 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Test execution error:', err);
    server.close();
    process.exit(1);
  }
}

runVerification();
