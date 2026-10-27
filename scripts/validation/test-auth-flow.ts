/**
 * NECL Authentication Flow Testing Script
 * 
 * Purpose: Test the complete authentication flow to ensure all fixes work correctly
 * 
 * Prerequisites:
 * 1. Supabase project URL and anon key in .env
 * 2. Admin users created in database
 * 3. Run from project root: npm install && npx tsx scripts/test-auth-flow.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility to prompt user for input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

async function testAuthFlow() {
  console.log('\n🔐 NECL Authentication Flow Test\n');
  console.log('═'.repeat(60));
  
  try {
    // Test 1: Anonymous access should be blocked
    console.log('\n📋 Test 1: Verify anonymous access is blocked');
    console.log('─'.repeat(60));
    
    const { data: anonData, error: anonError } = await supabase
      .from('client_companies')
      .select('*')
      .limit(1);
    
    if (anonError) {
      console.log('✅ PASS: Anonymous access blocked');
      console.log(`   Error: ${anonError.message}`);
    } else if (anonData && anonData.length === 0) {
      console.log('✅ PASS: Anonymous query returned empty (RLS working)');
    } else {
      console.log('❌ FAIL: Anonymous access is allowed! Security issue!');
      console.log(`   Data returned: ${JSON.stringify(anonData)}`);
      return;
    }

    // Test 2: Admin login
    console.log('\n📋 Test 2: Admin login');
    console.log('─'.repeat(60));
    
    const email = await prompt('Enter admin email (or press Enter for admin@necl.com): ');
    const password = await prompt('Enter password: ');
    
    const adminEmail = email.trim() || 'admin@necl.com';
    
    console.log(`\nAttempting login as: ${adminEmail}`);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: password.trim()
    });

    if (authError) {
      console.log('❌ FAIL: Login failed');
      console.log(`   Error: ${authError.message}`);
      return;
    }

    console.log('✅ PASS: Login successful');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${authData.user.email}`);

    // Test 3: Verify session
    console.log('\n📋 Test 3: Verify session');
    console.log('─'.repeat(60));
    
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      console.log('❌ FAIL: No active session');
      return;
    }

    console.log('✅ PASS: Session verified');
    console.log(`   Expires at: ${new Date(sessionData.session.expires_at! * 1000).toLocaleString()}`);

    // Test 4: Query admin_users table
    console.log('\n📋 Test 4: Query admin_users table');
    console.log('─'.repeat(60));
    
    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_uid', authData.user.id)
      .single();

    if (adminUserError) {
      console.log('❌ FAIL: Could not fetch admin user');
      console.log(`   Error: ${adminUserError.message}`);
      console.log('   Note: Make sure admin_users record exists for this auth user');
      return;
    }

    console.log('✅ PASS: Admin user record found');
    console.log(`   Name: ${adminUser.name}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Active: ${adminUser.is_active}`);

    // Test 5: Access client data (should work now)
    console.log('\n📋 Test 5: Access client companies (authenticated)');
    console.log('─'.repeat(60));
    
    const { data: clientData, error: clientError } = await supabase
      .from('client_companies')
      .select('id, company_name, city, status')
      .limit(5);

    if (clientError) {
      console.log('❌ FAIL: Could not access client data');
      console.log(`   Error: ${clientError.message}`);
      return;
    }

    console.log('✅ PASS: Client data accessible');
    console.log(`   Records found: ${clientData.length}`);
    if (clientData.length > 0) {
      console.log(`   First client: ${clientData[0].company_name}`);
    }

    // Test 6: Test RLS helper function
    console.log('\n📋 Test 6: Test is_active_admin() function');
    console.log('─'.repeat(60));
    
    const { data: funcResult, error: funcError } = await supabase.rpc('is_active_admin');

    if (funcError) {
      console.log('⚠️  WARN: Could not call is_active_admin() function');
      console.log(`   Error: ${funcError.message}`);
    } else {
      console.log(`✅ PASS: is_active_admin() returned: ${funcResult}`);
    }

    // Test 7: Verify profile update
    console.log('\n📋 Test 7: Test profile update (non-role fields)');
    console.log('─'.repeat(60));
    
    const { data: updateData, error: updateError } = await supabase
      .from('admin_users')
      .update({ 
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${adminUser.name}`,
        updated_at: new Date().toISOString()
      })
      .eq('auth_uid', authData.user.id)
      .select()
      .single();

    if (updateError) {
      console.log('❌ FAIL: Could not update profile');
      console.log(`   Error: ${updateError.message}`);
    } else {
      console.log('✅ PASS: Profile updated successfully');
    }

    // Test 8: Verify cannot change own role
    console.log('\n📋 Test 8: Verify role protection (should fail)');
    console.log('─'.repeat(60));
    
    const { error: roleError } = await supabase
      .from('admin_users')
      .update({ role: 'SUPER_ADMIN' })
      .eq('auth_uid', authData.user.id);

    if (roleError) {
      console.log('✅ PASS: Role change blocked (as expected)');
      console.log(`   Error: ${roleError.message}`);
    } else {
      console.log('❌ FAIL: Role was changed (security issue!)');
    }

    // Test 9: Sign out
    console.log('\n📋 Test 9: Sign out');
    console.log('─'.repeat(60));
    
    await supabase.auth.signOut();
    
    const { data: postSignOutSession } = await supabase.auth.getSession();
    
    if (!postSignOutSession.session) {
      console.log('✅ PASS: Signed out successfully');
    } else {
      console.log('❌ FAIL: Session still active after sign out');
    }

    // Test 10: Verify access revoked after sign out
    console.log('\n📋 Test 10: Verify access revoked after sign out');
    console.log('─'.repeat(60));
    
    const { data: postSignOutData, error: postSignOutError } = await supabase
      .from('client_companies')
      .select('*')
      .limit(1);

    if (postSignOutError) {
      console.log('✅ PASS: Access revoked after sign out');
    } else if (postSignOutData && postSignOutData.length === 0) {
      console.log('✅ PASS: Access revoked (empty result)');
    } else {
      console.log('❌ FAIL: Still have access after sign out!');
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ All authentication tests completed!');
    console.log('═'.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ Test failed with exception:');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    rl.close();
  }
}

// Run tests
testAuthFlow();
