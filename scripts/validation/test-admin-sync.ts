import { supabase } from '../server/src/supabase';

async function test() {
  console.log('Testing Supabase admin auth...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });
  console.log('Admin Auth User ID:', authData?.user?.id, 'Error:', authErr?.message);

  const { data: comps, error: compErr } = await supabase
    .from('client_companies')
    .select('id, company_name, status, client_code')
    .limit(10);
  console.log('client_companies count:', comps?.length, 'Error:', compErr?.message);
  if (comps) {
    console.log('First 3 companies:', comps.slice(0, 3));
  }

  const { data: users, error: userErr } = await supabase
    .from('client_users')
    .select('id, client_id, full_name, mobile, status')
    .limit(5);
  console.log('client_users count:', users?.length, 'Error:', userErr?.message);

  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select('id, reference_id, category, document_type, verification_status')
    .limit(5);
  console.log('documents count:', docs?.length, 'Error:', docErr?.message);
}

test().catch(console.error);
