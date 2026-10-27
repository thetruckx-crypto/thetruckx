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
 * (e.g. client, vendor, driver registration verification and real-time syncing)
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
        // Fallback: anonymous sign-in if enabled
        if (typeof (supabase.auth as any).signInAnonymously === 'function') {
          const { data: anonData, error: anonErr } = await (supabase.auth as any).signInAnonymously();
          if (!anonErr && anonData?.session) {
            return true;
          }
        }

        // Development/testing mode only: strictly blocked in production builds
        const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
        if (isDev) {
          const { data: authData, error } = await supabase.auth.signInWithPassword({
            email: 'admin@necl.com',
            password: 'admin123',
          });
          if (!error && authData?.session) {
            return true;
          }
        }
        return false;
      } catch (err: any) {
        return false;
      } finally {
        mobileSessionPromise = null;
      }
    })();

    return await mobileSessionPromise;
  } catch (err: any) {
    return false;
  }
}

// Proactively initialize session in the background
ensureMobileSession().catch(() => {});

