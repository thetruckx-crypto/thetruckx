import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  'admin_users',
  'regional_hubs',
  'client_companies',
  'client_users',
  'vendor_companies',
  'vendor_users',
  'vendor_vehicle_links',
  'vendor_driver_links',
  'drivers',
  'driver_documents',
  'vehicles',
  'requirements',
  'vendor_requests',
  'vendor_quotations',
  'client_quotes',
  'client_quotations',
  'bookings',
  'trips',
  'trip_events',
  'pod_submissions',
  'documents',
  'notifications',
  'otp_verifications',
  'auth_audit_log',
  'audit_logs',
];

async function main() {
  console.log('1. Signing in as admin@necl.com...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    process.exit(1);
  }
  console.log('Signed in successfully:', auth.user.email, '(ID:', auth.user.id, ')');

  console.log('\n2. Checking table existence and counts...');
  const tableCounts = {};

  for (const tbl of TABLES) {
    try {
      const { data, count, error } = await supabase
        .from(tbl)
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        tableCounts[tbl] = { exists: false, error: error.message };
      } else {
        tableCounts[tbl] = {
          exists: true,
          count: count !== null ? count : (data?.length || 0),
          sample: data?.slice(0, 2),
        };
      }
    } catch (e) {
      tableCounts[tbl] = { exists: false, error: e.message };
    }
  }

  console.log('\n--- TABLE SUMMARY ---');
  for (const [tbl, info] of Object.entries(tableCounts)) {
    if (!info.exists) {
      console.log(`[  ABSENT / NO ACCESS  ] ${tbl} (${info.error})`);
    } else {
      console.log(`[ ${String(info.count).padStart(5, ' ')} rows ] ${tbl}`);
    }
  }

  console.log('\n--- SAMPLES FOR KEY TABLES ---');
  if (tableCounts.admin_users?.sample?.length) {
    console.log('admin_users:', JSON.stringify(tableCounts.admin_users.sample, null, 2));
  }
  if (tableCounts.client_companies?.sample?.length) {
    console.log('client_companies:', JSON.stringify(tableCounts.client_companies.sample, null, 2));
  }
  if (tableCounts.vendor_companies?.sample?.length) {
    console.log('vendor_companies:', JSON.stringify(tableCounts.vendor_companies.sample, null, 2));
  }
  if (tableCounts.drivers?.sample?.length) {
    console.log('drivers:', JSON.stringify(tableCounts.drivers.sample, null, 2));
  }
  if (tableCounts.vehicles?.sample?.length) {
    console.log('vehicles:', JSON.stringify(tableCounts.vehicles.sample, null, 2));
  }
  if (tableCounts.requirements?.sample?.length) {
    console.log('requirements:', JSON.stringify(tableCounts.requirements.sample, null, 2));
  }
  if (tableCounts.bookings?.sample?.length) {
    console.log('bookings:', JSON.stringify(tableCounts.bookings.sample, null, 2));
  }
  if (tableCounts.trips?.sample?.length) {
    console.log('trips:', JSON.stringify(tableCounts.trips.sample, null, 2));
  }
}

main();
