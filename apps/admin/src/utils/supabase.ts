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
 * Checks if the Supabase client has an active authenticated administrator session.
 */
export async function ensureAdminSession(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    return Boolean(sessionData?.session);
  } catch (err: any) {
    console.warn('[Admin Supabase] Ensure session error:', err.message);
    return false;
  }
}