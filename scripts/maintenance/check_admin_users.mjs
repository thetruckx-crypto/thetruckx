import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbsgmorzrccbyfmjbvgx.supabase.co";
const ANON_KEY = "sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  const { data: existingSuper, error: superErr } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', 'superadmin@necl.com');

  console.log('existing superadmin:', existingSuper, superErr);

  if (!existingSuper || existingSuper.length === 0) {
    const { data: insertRes, error: insertErr } = await supabase
      .from('admin_users')
      .insert([
        {
          name: 'Super Administrator',
          email: 'superadmin@necl.com',
          role: 'SUPER_ADMIN',
          is_active: true,
        }
      ])
      .select();
    console.log('insert superadmin result:', insertRes, insertErr);
  }
}

run();
