import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

export const supabase = createClient(supabaseUrl, supabaseKey);
