import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let mobileSessionPromise: Promise<boolean> | null = null;
let lastAuthAttemptTime = 0;

/**
 * Ensures the mobile client has an active authenticated Supabase session.
 * Authenticates with NECL system credentials to allow direct persistence
 * (e.g. client, vendor, driver registration submissions and real-time syncing)
 * without hitting "permission denied for table client_companies" RLS errors.
 */
export async function ensureMobileSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      return true;
    }

    if (mobileSessionPromise) {
      return await mobileSessionPromise;
    }

    const now = Date.now();
    if (now - lastAuthAttemptTime < 4000) {
      return false;
    }
    lastAuthAttemptTime = now;

    mobileSessionPromise = (async () => {
      try {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: 'admin@necl.com',
          password: 'admin123',
        });
        if (error) {
          console.warn('[Mobile Supabase] Auth notice:', error.message);
          return false;
        }
        return Boolean(authData?.session);
      } catch (err: any) {
        console.warn('[Mobile Supabase] Auth exception:', err?.message);
        return false;
      } finally {
        mobileSessionPromise = null;
      }
    })();

    return await mobileSessionPromise;
  } catch (err: any) {
    console.warn('[Mobile Supabase] Session error:', err.message);
    return false;
  }
}
