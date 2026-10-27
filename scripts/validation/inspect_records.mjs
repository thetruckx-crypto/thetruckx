import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
  const tables = [
    'client_companies',
    'client_users',
    'vendor_companies',
    'vendor_users',
    'transport_requirements',
    'client_quotes',
    'bookings',
    'trips',
    'documents',
    'vehicles',
    'drivers',
    'auth_audit_log'
  ];

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' });
      if (error) {
        console.log(`Table ${table}: ERROR ${error.message}`);
      } else {
        console.log(`Table ${table}: ${data.length} records`);
        if (data.length > 0 && data.length <= 10) {
          console.log(data.map(d => ({ id: d.id, name: d.company_name || d.vendor_name || d.full_name || d.client_code || d.registration_number })));
        }
      }
    } catch (e) {
      console.log(`Table ${table}: EXCEPTION ${e.message}`);
    }
  }
}

inspect();
