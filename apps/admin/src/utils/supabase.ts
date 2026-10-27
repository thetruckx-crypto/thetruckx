import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

let sessionInitPromise: Promise<boolean> | null = null;

/**
 * Ensures the Supabase client has an active authenticated administrator session.
 * Authenticates with NECL administrator credentials if not currently authenticated,
 * ensuring PostgreSQL Row-Level Security (RLS) permits querying client_companies,
 * requirements, bookings, documents, and other core operational tables.
 */
export async function ensureAdminSession(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      return true;
    }

    if (sessionInitPromise) {
      return await sessionInitPromise;
    }

    sessionInitPromise = (async () => {
      try {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: 'admin@necl.com',
          password: 'admin123',
        });
        if (error) {
          console.warn('[Admin Supabase] Ensure session notice:', error.message);
          return false;
        }
        return Boolean(authData?.session);
      } catch (err: any) {
        console.warn('[Admin Supabase] Ensure session exception:', err?.message);
        return false;
      } finally {
        sessionInitPromise = null;
      }
    })();

    return await sessionInitPromise;
  } catch (err: any) {
    console.warn('[Admin Supabase] Ensure session error:', err?.message);
    return false;
  }
}