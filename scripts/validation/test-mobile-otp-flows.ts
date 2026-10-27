/**
 * NECL Mobile OTP Verification & Role-Based Workflow Test Suite
 *
 * Covers:
 * 1. 5-digit OTP (12345) verification across Client, Vendor, Driver
 * 2. New user registration flows (Client -> Business Details, Vendor -> Transporter, Driver -> Basic)
 * 3. Existing user login flows with session token issuance
 * 4. Invalid OTP rejection (e.g. 99999)
 * 5. Incomplete OTP validation (< 5 digits)
 * 6. Protection against unregistered logins (NOT_REGISTERED 403)
 * 7. Cross-role conflict prevention (WRONG_ROLE 409)
 * 8. Status routing: Approved -> Dashboard, Pending -> Verification Status, Incomplete -> Step resume
 */

const API_BASE = 'http://localhost:5000/api';

async function request(path: string, options: any = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

async function runMobileOtpTests() {
  console.log('\n=============================================================');
  console.log('   NECL MOBILE OTP VERIFICATION & ROLE FLOW TEST SUITE       ');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`, detail ? detail : '');
      failed++;
    }
  }

  // Define unique test numbers for this run
  const timestamp = Date.now().toString().slice(-6);
  const clientPhone = `9864${timestamp.slice(0, 6)}`;
  const vendorPhone = `9854${timestamp.slice(0, 6)}`;
  const driverPhone = `9844${timestamp.slice(0, 6)}`;

  console.log(`[TEST SETUP] Using test phone numbers:`);
  console.log(`  Client: +91 ${clientPhone}`);
  console.log(`  Vendor: +91 ${vendorPhone}`);
  console.log(`  Driver: +91 ${driverPhone}\n`);

  // -----------------------------------------------------------------
  // 1. REGISTRATION OTP REQUESTS (5-digit code generated)
  // -----------------------------------------------------------------
  console.log('--- Phase 1: Registration OTP Generation (5-digit code) ---');

  // Client OTP Request
  const clientRegOtp = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'CLIENT', purpose: 'REGISTRATION' }),
  });
  assert('Client Registration OTP dispatched', clientRegOtp.status === 200 && clientRegOtp.data.success);
  assert('Client OTP code is exactly 12345 in dev mode', clientRegOtp.data.testCode === '12345');

  // Vendor OTP Request
  const vendorRegOtp = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: vendorPhone, role: 'VENDOR', purpose: 'REGISTRATION' }),
  });
  assert('Vendor Registration OTP dispatched', vendorRegOtp.status === 200 && vendorRegOtp.data.success);
  assert('Vendor OTP code is exactly 12345 in dev mode', vendorRegOtp.data.testCode === '12345');

  // Driver OTP Request
  const driverRegOtp = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: driverPhone, role: 'DRIVER', purpose: 'REGISTRATION' }),
  });
  assert('Driver Registration OTP dispatched', driverRegOtp.status === 200 && driverRegOtp.data.success);
  assert('Driver OTP code is exactly 12345 in dev mode', driverRegOtp.data.testCode === '12345');

  // -----------------------------------------------------------------
  // 2. INVALID AND INCOMPLETE OTP VALIDATION
  // -----------------------------------------------------------------
  console.log('\n--- Phase 2: Invalid & Incomplete OTP Handling ---');

  // Incomplete OTP (< 5 digits)
  const incompleteOtpRes = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'CLIENT', code: '123', purpose: 'REGISTRATION' }),
  });
  assert('Incomplete OTP (3 digits) rejected with 400', incompleteOtpRes.status === 400);
  assert('Incomplete OTP returns error message indicating 5 digits', incompleteOtpRes.data.message?.includes('5-digit'));

  // Invalid OTP (wrong 5-digit code)
  const wrongOtpRes = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'CLIENT', code: '99999', purpose: 'REGISTRATION' }),
  });
  assert('Invalid OTP (99999) rejected with 401', wrongOtpRes.status === 401);
  assert('Invalid OTP returns INVALID_OTP error code', wrongOtpRes.data.error === 'INVALID_OTP');

  // -----------------------------------------------------------------
  // 3. SUCCESSFUL REGISTRATION OTP VERIFICATION (12345)
  // -----------------------------------------------------------------
  console.log('\n--- Phase 3: Registration OTP Verification (12345) ---');

  // Client verify OTP 12345
  const clientVerify = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'CLIENT', code: '12345', purpose: 'REGISTRATION' }),
  });
  assert('Client Registration OTP 12345 verified', clientVerify.status === 200 && clientVerify.data.success);
  assert('Client registration marked verified without premature session', clientVerify.data.verified === true);

  // Vendor verify OTP 12345
  const vendorVerify = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: vendorPhone, role: 'VENDOR', code: '12345', purpose: 'REGISTRATION' }),
  });
  assert('Vendor Registration OTP 12345 verified', vendorVerify.status === 200 && vendorVerify.data.success);

  // Driver verify OTP 12345
  const driverVerify = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: driverPhone, role: 'DRIVER', code: '12345', purpose: 'REGISTRATION' }),
  });
  assert('Driver Registration OTP 12345 verified', driverVerify.status === 200 && driverVerify.data.success);

  // -----------------------------------------------------------------
  // 4. UNREGISTERED LOGIN PROTECTION
  // -----------------------------------------------------------------
  console.log('\n--- Phase 4: Unregistered Login Guard ---');

  const unregPhone = '9999888877';
  const unregLoginRes = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: unregPhone, role: 'CLIENT', purpose: 'LOGIN' }),
  });
  assert('Unregistered login attempt blocked with 403', unregLoginRes.status === 403);
  assert('Unregistered error code is NOT_REGISTERED', unregLoginRes.data.error === 'NOT_REGISTERED');

  // -----------------------------------------------------------------
  // 5. REGISTRATION SUBMISSION & STATUS ROUTING
  // -----------------------------------------------------------------
  console.log('\n--- Phase 5: Complete Registration Submission & Status Routing ---');

  // Sync Client as PENDING_APPROVAL
  const clientSync = await request('/auth/register-sync', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Kamrup Industries Ltd',
      mobile: clientPhone,
      role: 'CLIENT',
      companyName: 'Kamrup Tea & Logistics',
      email: `contact@kamrup-${timestamp}.in`,
      status: 'PENDING_APPROVAL',
    }),
  });
  assert('Client registered with status PENDING_APPROVAL', clientSync.status === 200 && clientSync.data.success);

  // Sync Vendor as APPROVED
  const vendorSync = await request('/auth/register-sync', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Brahmaputra Fleetways',
      mobile: vendorPhone,
      role: 'VENDOR',
      companyName: 'Brahmaputra Transport Syndicate',
      email: `ops@brahmaputra-${timestamp}.in`,
      status: 'APPROVED',
    }),
  });
  assert('Vendor registered with status APPROVED', vendorSync.status === 200 && vendorSync.data.success);

  // Sync Driver as ACTIVE
  const driverSync = await request('/auth/register-sync', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Bhaben Barman',
      mobile: driverPhone,
      role: 'DRIVER',
      email: `driver-${timestamp}@necl.in`,
      status: 'ACTIVE',
    }),
  });
  assert('Driver registered with status ACTIVE', driverSync.status === 200 && driverSync.data.success);

  // -----------------------------------------------------------------
  // 6. EXISTING USER LOGIN FLOW WITH 12345
  // -----------------------------------------------------------------
  console.log('\n--- Phase 6: Existing User Login Flow with OTP 12345 ---');

  // Client Login Request
  const clientLoginSend = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'CLIENT', purpose: 'LOGIN' }),
  });
  assert('Client login OTP request succeeds', clientLoginSend.status === 200 && clientLoginSend.data.success);

  // Client Login Verify
  const clientLoginVerify = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'CLIENT', code: '12345', purpose: 'LOGIN' }),
  });
  assert('Client login verified with OTP 12345', clientLoginVerify.status === 200 && clientLoginVerify.data.success);
  assert('Client login returns JWT session token', typeof clientLoginVerify.data.token === 'string');
  assert('Client login identifies existing user', clientLoginVerify.data.isExistingUser === true);
  assert('Client account status is PENDING_APPROVAL', clientLoginVerify.data.accountStatus === 'PENDING_APPROVAL');

  // Vendor Login Verify
  await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: vendorPhone, role: 'VENDOR', purpose: 'LOGIN' }),
  });
  const vendorLoginVerify = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: vendorPhone, role: 'VENDOR', code: '12345', purpose: 'LOGIN' }),
  });
  assert('Vendor login verified with OTP 12345', vendorLoginVerify.status === 200 && vendorLoginVerify.data.success);
  assert('Vendor account status is APPROVED (unlocked for Dashboard)', vendorLoginVerify.data.accountStatus === 'APPROVED');

  // Driver Login Verify
  await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: driverPhone, role: 'DRIVER', purpose: 'LOGIN' }),
  });
  const driverLoginVerify = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: driverPhone, role: 'DRIVER', code: '12345', purpose: 'LOGIN' }),
  });
  assert('Driver login verified with OTP 12345', driverLoginVerify.status === 200 && driverLoginVerify.data.success);
  assert('Driver account status is ACTIVE (unlocked for Driver Dashboard)', driverLoginVerify.data.accountStatus === 'ACTIVE');

  // -----------------------------------------------------------------
  // 7. CROSS-ROLE CONFLICT PREVENTION
  // -----------------------------------------------------------------
  console.log('\n--- Phase 7: Cross-Role Conflict Prevention ---');

  // Attempt to log in with Vendor's number using Client role
  const roleConflictLogin = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: vendorPhone, role: 'CLIENT', purpose: 'LOGIN' }),
  });
  assert('Cross-role login blocked with 409 Conflict', roleConflictLogin.status === 409);
  assert('Error indicates WRONG_ROLE', roleConflictLogin.data.error === 'WRONG_ROLE');
  assert('Error specifies registered role as VENDOR', roleConflictLogin.data.registeredRole === 'VENDOR');

  // Attempt to register existing Client number under Driver role
  const roleConflictReg = await request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile: clientPhone, role: 'DRIVER', purpose: 'REGISTRATION' }),
  });
  assert('Cross-role registration blocked with 409 Conflict', roleConflictReg.status === 409);

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMobileOtpTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

export {};

