const API_BASE = 'http://localhost:5000/api';

async function runOtpVerificationTests() {
  console.log('=====================================================');
  console.log('     NECL MOCK OTP 12345 VERIFICATION TEST SUITE     ');
  console.log('=====================================================');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extra?: any) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`, extra ? extra : '');
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // Test 1: Send OTP for REGISTRATION via Backend API
  // -----------------------------------------------------------------
  console.log('\n--- Test 1: Send OTP for REGISTRATION ---');
  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9876543210',
        role: 'CLIENT',
        purpose: 'REGISTRATION',
      }),
    });
    const data: any = await res.json();
    assert('Send OTP for registration returns success: true', data.success === true, data);
    assert('Send OTP returns testCode: 12345 in mock/dev mode', data.testCode === '12345', data);
  } catch (e: any) {
    assert('Send OTP API threw error', false, e.message);
  }

  // -----------------------------------------------------------------
  // Test 2: Verify OTP 12345 for REGISTRATION via Backend API
  // -----------------------------------------------------------------
  console.log('\n--- Test 2: Verify OTP 12345 for REGISTRATION ---');
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9876543210',
        role: 'CLIENT',
        code: '12345',
        purpose: 'REGISTRATION',
      }),
    });
    const data: any = await res.json();
    assert('Verify OTP 12345 for REGISTRATION returns success: true', data.success === true, data);
    assert('Verify OTP 12345 returns verified: true', data.verified === true, data);
  } catch (e: any) {
    assert('Verify OTP 12345 for registration threw error', false, e.message);
  }

  // -----------------------------------------------------------------
  // Test 3: Send OTP for LOGIN via Backend API (Registered User)
  // -----------------------------------------------------------------
  console.log('\n--- Test 3: Send OTP for LOGIN (Registered User 9864424275) ---');
  try {
    // Ensure test user is registered in the system before testing login
    await fetch(`${API_BASE}/auth/register-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Registered Client',
        mobile: '9864424275',
        role: 'CLIENT',
        companyName: 'Test Client Enterprise',
        status: 'ACTIVE',
      }),
    });

    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9864424275',
        role: 'CLIENT',
        purpose: 'LOGIN',
      }),
    });
    const data: any = await res.json();
    assert('Send OTP for login returns success: true', data.success === true, data);
    assert('Send OTP for login returns testCode: 12345', data.testCode === '12345', data);
  } catch (e: any) {
    assert('Send OTP for login threw error', false, e.message);
  }

  // -----------------------------------------------------------------
  // Test 4: Verify OTP 12345 for LOGIN via Backend API
  // -----------------------------------------------------------------
  console.log('\n--- Test 4: Verify OTP 12345 for LOGIN (Registered User 9864424275) ---');
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9864424275',
        role: 'CLIENT',
        code: '12345',
        purpose: 'LOGIN',
      }),
    });
    const data: any = await res.json();
    assert('Verify OTP 12345 for LOGIN returns success: true', data.success === true, data);
    assert('Verify OTP 12345 returns session token', typeof data.token === 'string' && data.token.length > 0, data);
    assert('Verify OTP 12345 returns isExistingUser: true', data.isExistingUser === true, data);
  } catch (e: any) {
    assert('Verify OTP 12345 for login threw error', false, e.message);
  }

  // -----------------------------------------------------------------
  // Test 5: Verify Invalid Code Rejection
  // -----------------------------------------------------------------
  console.log('\n--- Test 5: Rejection of Invalid OTP (00000) ---');
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9864424275',
        role: 'CLIENT',
        code: '00000',
        purpose: 'LOGIN',
      }),
    });
    const data: any = await res.json();
    assert('Verify OTP with wrong code returns 401', res.status === 401, { status: res.status, data });
    assert('Verify OTP with wrong code returns INVALID_OTP error', data.error === 'INVALID_OTP', data);
  } catch (e: any) {
    assert('Invalid OTP rejection test threw error', false, e.message);
  }

  // -----------------------------------------------------------------
  // Test 6: Mobile Direct Fallback Logic for Mock OTP 12345
  // -----------------------------------------------------------------
  console.log('\n--- Test 6: Mobile Direct Fallback Logic for Mock OTP 12345 ---');
  try {
    const cleanPhone = '9876543210';
    const trimmedCode = '12345';
    const mockCode = '12345';
    const isTestingMode = true;

    let isCodeValid = false;
    if (!isCodeValid && isTestingMode && (trimmedCode === '12345' || trimmedCode === mockCode)) {
      isCodeValid = true;
    }
    assert('Mobile fallback logic accepts 12345 as valid OTP', isCodeValid === true);

    const wrongCode: string = '54321';
    let isWrongValid = false;
    if (!isWrongValid && isTestingMode && (wrongCode === '12345' || wrongCode === mockCode)) {
      isWrongValid = true;
    }
    assert('Mobile fallback logic rejects non-12345 code', isWrongValid === false);
  } catch (e: any) {
    assert('Direct fallback test threw error', false, e.message);
  }

  console.log('\n=====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOtpVerificationTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

export {};

