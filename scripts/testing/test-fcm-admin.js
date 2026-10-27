const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

async function testFCMAdmin() {
  const serviceAccountPath = path.resolve(__dirname, '../../server/service-account.json');
  console.log('1. Checking service account file at:', serviceAccountPath);
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('FAIL: service-account.json does not exist');
    return;
  }
  
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  console.log('Project ID:', serviceAccount.project_id);
  console.log('Client Email:', serviceAccount.client_email);

  const app = initializeApp({
    credential: cert(serviceAccount),
  });

  console.log('2. Firebase Admin initialized successfully!');

  // Test dry-run message validate
  try {
    // We send a dry_run message to a dummy or test token to test authentication with Google's v1 server
    console.log('3. Validating OAuth2 token with Google FCM HTTP v1 server...');
    const dummyToken = 'bk3RNwTe3H0:CI2k_HHwgIpoDKCIZvvDMExUdFQ3P1...';
    await getMessaging().send({
      token: dummyToken,
      notification: {
        title: 'THE TRUCKX - Test Push',
        body: 'Testing FCM server authentication',
      },
    }, true); // dryRun = true
    console.log('4. Google FCM v1 response: Authentication successful (dry run validated)!');
  } catch (err) {
    if (err.code === 'messaging/invalid-argument' || err.code === 'messaging/registration-token-not-registered') {
      console.log('4. PASS: Google FCM HTTP v1 server authenticated successfully (rejected test token as expected):', err.code);
    } else {
      console.log('4. Google FCM server error:', err.code, err.message);
    }
  }
}

testFCMAdmin().catch(console.error);
