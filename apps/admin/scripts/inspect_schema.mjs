import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const supabaseKey = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'bookings' }).catch(() => ({}));
  console.log('cols rpc:', cols);
  console.log('--- Signing in as admin@necl.com ---');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  if (authErr) {
    console.error('Sign in error:', authErr);
    return;
  }
  console.log('Signed in successfully as:', authData.user.email);

  console.log('--- Inspecting bookings table ---');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*').limit(5);
  if (bErr) {
    console.error('Bookings error:', bErr);
  } else {
    console.log('Bookings count in DB:', bookings?.length);
    if (bookings && bookings.length > 0) {
      console.log('Sample booking keys:', Object.keys(bookings[0]));
      console.log('Sample booking:', JSON.stringify(bookings[0], null, 2));
    }
  }

  console.log('--- Inspecting client_companies ---');
  const { data: clients, error: cErr } = await supabase.from('client_companies').select('id, company_name').limit(5);
  if (cErr) console.error('Clients error:', cErr);
  else console.log('Sample clients:', clients);

  console.log('--- Inspecting trips table ---');
  const { data: trips, error: tErr } = await supabase.from('trips').select('*').limit(3);
  if (tErr) console.error('Trips error:', tErr);
  else {
    console.log('Trips count in DB:', trips?.length);
    if (trips && trips.length > 0) {
      console.log('Sample trip keys:', Object.keys(trips[0]));
      console.log('Sample trip:', JSON.stringify(trips[0], null, 2));
    }
  }

  console.log('--- Inspecting requirements table ---');
  const { data: reqs, error: rErr } = await supabase.from('requirements').select('*').limit(3);
  if (rErr) console.error('Requirements error:', rErr);
  else {
    console.log('Requirements count in DB:', reqs?.length);
    if (reqs && reqs.length > 0) {
      console.log('Sample requirement keys:', Object.keys(reqs[0]));
      console.log('Sample requirement:', JSON.stringify(reqs[0], null, 2));
    }
  }
}

inspect();
