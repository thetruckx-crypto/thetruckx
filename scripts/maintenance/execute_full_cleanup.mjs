import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR_ADMIN = path.join(PROJECT_ROOT, 'archive', 'backups', 'database');
const BACKUP_FILE_ADMIN = path.join(BACKUP_DIR_ADMIN, `backup_before_cleanup_${TIMESTAMP}.json`);
const SERVER_DATA_DIR = path.join(PROJECT_ROOT, 'server', 'data');
const BACKUP_FILE_SERVER = path.join(SERVER_DATA_DIR, `backup_before_cleanup_${TIMESTAMP}.json`);
const SERVER_REGISTRY_FILE = path.join(SERVER_DATA_DIR, 'server_user_registry.json');
const SERVER_DRAFTS_FILE = path.join(SERVER_DATA_DIR, 'admin_drafts.json');

const TABLES_TO_CLEAN_IN_ORDER = [
  'admin_registration_drafts',
  'audit_logs',
  'chat_attachments',
  'chat_messages',
  'chat_threads',
  'weighments',
  'charge_lines',
  'payment_records',
  'vendor_quotations',
  'vendor_requests',
  'client_quotes',
  'trips',
  'bookings',
  'requirements',
  'documents',
  'vendor_vehicle_links',
  'drivers',
  'vehicles',
  'client_users',
  'vendor_users',
  'client_companies',
  'vendor_companies',
  'otp_verifications',
];

const PRESERVED_TABLES = [
  'admin_users',
  'regional_hubs',
];

async function main() {
  console.log('========================================================================');
  console.log('🚀 NECL COMPLETE TRANSACTIONAL & TEST DATA CLEANUP SCRIPT');
  console.log('========================================================================\n');

  // 1. Authenticate as Administrator
  console.log('Step 1: Authenticating as Admin (admin@necl.com)...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  if (authErr || !auth?.user) {
    console.error('❌ Failed to authenticate as Admin:', authErr?.message);
    process.exit(1);
  }
  console.log('✅ Authenticated as:', auth.user.email, '(ID:', auth.user.id, ')\n');

  // 2. Perform Complete Data Backup
  console.log('Step 2: Creating complete snapshot backup before any deletions...');
  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      supabaseUrl: SUPABASE_URL,
      performedBy: auth.user.email,
    },
    tables: {},
    localRegistry: [],
  };

  for (const table of TABLES_TO_CLEAN_IN_ORDER) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`⚠️ Table ${table} backup note:`, error.message);
        backupData.tables[table] = { error: error.message, records: [] };
      } else {
        backupData.tables[table] = { count: data.length, records: data };
        console.log(`📦 Backed up ${String(data.length).padStart(3, ' ')} records from ${table}`);
      }
    } catch (e) {
      backupData.tables[table] = { error: e.message, records: [] };
    }
  }

  // Backup server_user_registry.json if exists
  if (fs.existsSync(SERVER_REGISTRY_FILE)) {
    try {
      const reg = JSON.parse(fs.readFileSync(SERVER_REGISTRY_FILE, 'utf-8'));
      backupData.localRegistry = reg;
      console.log(`📦 Backed up ${reg.length} entries from server_user_registry.json`);
    } catch (e) {
      console.warn('⚠️ Registry backup note:', e.message);
    }
  }

  // Write backup files
  if (!fs.existsSync(BACKUP_DIR_ADMIN)) {
    fs.mkdirSync(BACKUP_DIR_ADMIN, { recursive: true });
  }
  fs.writeFileSync(BACKUP_FILE_ADMIN, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`💾 Saved Admin Backup: ${BACKUP_FILE_ADMIN}`);

  if (fs.existsSync(SERVER_DATA_DIR)) {
    fs.writeFileSync(BACKUP_FILE_SERVER, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`💾 Saved Server Backup: ${BACKUP_FILE_SERVER}`);
  }
  console.log('✅ Full pre-cleanup backup successfully created.\n');

  // 3. Execute Deletion in Exact Dependency Order (Children before Parents)
  console.log('Step 3: Deleting testing & transactional records in dependency order...');
  const deletionSummary = {};

  for (const table of TABLES_TO_CLEAN_IN_ORDER) {
    try {
      // First, get all IDs to delete
      const { data: rows, error: selectErr } = await supabase.from(table).select('id');
      if (selectErr) {
        console.log(`⏭️ Table ${table}: Skipped (${selectErr.message})`);
        deletionSummary[table] = { status: 'SKIPPED', error: selectErr.message };
        continue;
      }

      if (!rows || rows.length === 0) {
        console.log(`ℹ️ Table ${table}: 0 rows (Already empty)`);
        deletionSummary[table] = { status: 'ALREADY_EMPTY', deleted: 0 };
        continue;
      }

      const ids = rows.map((r) => r.id);
      console.log(`🗑️ Deleting ${ids.length} records from ${table}...`);

      // Delete in chunks if large, otherwise in single query
      const chunkSize = 50;
      let totalDeleted = 0;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const slice = ids.slice(i, i + chunkSize);
        const { error: delErr } = await supabase.from(table).delete().in('id', slice);
        if (delErr) {
          throw new Error(`Failed to delete from ${table}: ${delErr.message}`);
        }
        totalDeleted += slice.length;
      }

      console.log(`✅ Successfully deleted ${totalDeleted} records from ${table}.`);
      deletionSummary[table] = { status: 'DELETED', deleted: totalDeleted };
    } catch (err) {
      console.error(`❌ Error deleting from ${table}:`, err.message);
      deletionSummary[table] = { status: 'ERROR', error: err.message };
    }
  }

  // 4. Clear Local Server User Registry & Drafts
  console.log('\nStep 4: Resetting server local user registry and drafts...');
  if (fs.existsSync(SERVER_REGISTRY_FILE)) {
    try {
      fs.writeFileSync(SERVER_REGISTRY_FILE, JSON.stringify([], null, 2), 'utf-8');
      console.log('✅ server_user_registry.json successfully reset to empty array [].');
    } catch (e) {
      console.warn('⚠️ server_user_registry.json reset warning:', e.message);
    }
  }
  if (fs.existsSync(SERVER_DRAFTS_FILE)) {
    try {
      fs.writeFileSync(SERVER_DRAFTS_FILE, JSON.stringify([], null, 2), 'utf-8');
      console.log('✅ admin_drafts.json successfully reset to empty array [].');
    } catch (e) {
      console.warn('⚠️ admin_drafts.json reset warning:', e.message);
    }
  }

  // 5. Verify Post-Cleanup State
  console.log('\n========================================================================');
  console.log('📊 POST-CLEANUP DATABASE & CONFIGURATION AUDIT VERIFICATION');
  console.log('========================================================================');

  console.log('\n[ Cleaned Tables (Expected: 0 rows) ]');
  let cleanSuccess = true;
  for (const table of TABLES_TO_CLEAN_IN_ORDER) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`- ${table.padEnd(25, ' ')}: ERROR (${error.message})`);
    } else {
      const isClean = count === 0;
      console.log(`- ${table.padEnd(25, ' ')}: ${count} rows ${isClean ? '✅ (Clean)' : '⚠️ (Not Empty)'}`);
      if (!isClean) cleanSuccess = false;
    }
  }

  console.log('\n[ Preserved Master Tables (Expected: Intact) ]');
  for (const table of PRESERVED_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`- ${table.padEnd(25, ' ')}: ERROR (${error.message})`);
      cleanSuccess = false;
    } else {
      console.log(`- ${table.padEnd(25, ' ')}: ${count} rows ✅ (Intact Master Data)`);
    }
  }

  console.log('\n[ Preserved Admin Account Check ]');
  const { data: adminUser, error: adminErr } = await supabase
    .from('admin_users')
    .select('id, name, email, role, is_active')
    .eq('email', 'admin@necl.com')
    .single();

  if (adminErr || !adminUser) {
    console.error('❌ Critical: Admin user missing!', adminErr);
    cleanSuccess = false;
  } else {
    console.log(`✅ Admin Account Verified: ${adminUser.name} (${adminUser.email}), Role: ${adminUser.role}, Active: ${adminUser.is_active}`);
  }

  console.log('\n========================================================================');
  if (cleanSuccess) {
    console.log('🎉 ALL TEST DATA PERMANENTLY REMOVED. DATABASE IS 100% PRISTINE & READY!');
  } else {
    console.log('⚠️ Cleanup finished with warnings. Review details above.');
  }
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Fatal cleanup exception:', err);
  process.exit(1);
});
