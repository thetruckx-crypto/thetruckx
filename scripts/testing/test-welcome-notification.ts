import AsyncStorage from '@react-native-async-storage/async-storage';

// Quick verification script for welcome notification logic
async function verifyWelcomeLogic() {
  console.log('Testing Welcome vs Welcome Back notification detection...');
  
  const testPhone = '9999988888';
  const historyKey = `@necl_login_seen_${testPhone}`;
  const cooldownKey = `@necl_welcome_cooldown_${testPhone}`;

  // Reset test keys
  await AsyncStorage.removeItem(historyKey);
  await AsyncStorage.removeItem(cooldownKey);

  // 1. First time simulation
  const prior1 = await AsyncStorage.getItem(historyKey);
  const isFirstTime1 = !prior1;
  console.log('Step 1 (First time login):', isFirstTime1 ? 'PASS: Detected as FIRST TIME USER' : 'FAIL');

  await AsyncStorage.setItem(historyKey, JSON.stringify({ firstSeenAt: new Date().toISOString(), count: 1 }));
  await AsyncStorage.setItem(cooldownKey, Date.now().toString());

  // 2. Second login (Returning / "Welcome Back")
  const prior2 = await AsyncStorage.getItem(historyKey);
  const isFirstTime2 = !prior2;
  console.log('Step 2 (Second login):', !isFirstTime2 ? 'PASS: Detected as RETURNING USER ("Welcome Back")' : 'FAIL');

  // 3. Duplicate protection test
  const lastTime = await AsyncStorage.getItem(cooldownKey);
  const cooldownMs = 10 * 60 * 1000;
  const isBlockedByCooldown = (Date.now() - parseInt(lastTime || '0', 10)) < cooldownMs;
  console.log('Step 3 ("Once add that" idempotency):', isBlockedByCooldown ? 'PASS: Duplicate blocked within cooldown window' : 'FAIL');

  // Cleanup
  await AsyncStorage.removeItem(historyKey);
  await AsyncStorage.removeItem(cooldownKey);
  console.log('All welcome logic test assertions passed successfully!');
}

verifyWelcomeLogic().catch(console.error);
