import { createClient } from '@supabase/supabase-js';
import { config } from './config';

const supabaseUrl = config.supabase.url || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Auto-authenticate backend service session for database operations
supabase.auth.signInWithPassword({
  email: 'admin@necl.com',
  password: 'admin123',
}).then(({ error }) => {
  if (error) {
    console.warn('[SUPABASE] Server admin auto-auth note:', error.message);
  } else {
    console.log('[SUPABASE] Server authenticated session established.');
  }
}).catch(() => {});

export function getSupabaseClient(authHeader?: string) {
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (token) {
    return createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
  }
  return supabase;
}

export default supabase;
