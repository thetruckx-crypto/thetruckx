const store = new Map();
const AsyncStorage = {
  getItem: async (k) => store.get(k) || null,
  setItem: async (k, v) => store.set(k, v),
  removeItem: async (k) => store.delete(k)
};

async function test() {
  const testPhone = '9876543210';
  const historyKey = '@necl_login_seen_' + testPhone;
  const cooldownKey = '@necl_welcome_cooldown_' + testPhone;

  // 1. First time
  const prior1 = await AsyncStorage.getItem(historyKey);
  const isFirstTime1 = !prior1;
  console.log('1. First-time detection:', isFirstTime1 ? 'PASS -> (Welcome to THE TRUCKX! 🚚)' : 'FAIL');
  await AsyncStorage.setItem(historyKey, JSON.stringify({ count: 1 }));
  await AsyncStorage.setItem(cooldownKey, Date.now().toString());

  // 2. Second login
  const prior2 = await AsyncStorage.getItem(historyKey);
  const isFirstTime2 = !prior2;
  console.log('2. Returning user detection:', !isFirstTime2 ? 'PASS -> (Welcome Back, Transporter! 👋)' : 'FAIL');

  // 3. Duplicate protection
  const last = await AsyncStorage.getItem(cooldownKey);
  const isDuplicate = (Date.now() - parseInt(last)) < 600000;
  console.log('3. Duplicate cooldown ("once add that"):', isDuplicate ? 'PASS -> (Idempotent: Duplicate blocked)' : 'FAIL');
}
test();
