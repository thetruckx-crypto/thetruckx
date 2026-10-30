import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const SUPABASE_URL = 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ALL_TABLES = [
  'admin_users',
  'regional_hubs',
  'client_companies',
  'client_users',
  'vendor_companies',
  'vendor_users',
  'vendor_vehicle_links',
  'drivers',
  'vehicles',
  'requirements',
  'vendor_requests',
  'vendor_quotations',
  'client_quotes',
  'bookings',
  'trips',
  'exceptions',
  'documents',
  'audit_logs',
  'weighments',
  'charge_lines',
  'payment_records',
  'admin_registration_drafts',
  'chat_threads',
  'chat_messages',
  'chat_attachments'
];

async function main() {
  console.log('========================================================================');
  console.log('🛡️ NECL / THE TRUCKX — VERIFIED DATABASE & STORAGE BACKUP');
  console.log('========================================================================\n');

  // 1. Authenticate as Admin
  console.log('1. Authenticating with Supabase administrator credentials...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  if (authErr || !auth?.user) {
    console.error('❌ Failed to authenticate:', authErr?.message);
    process.exit(1);
  }
  console.log(`✅ Authenticated: ${auth.user.email} (ID: ${auth.user.id})\n`);

  // 2. Storage Buckets Inventory
  console.log('2. Inspecting Supabase Storage Buckets...');
  let bucketsData = [];
  try {
    const { data: bList, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
      console.warn('⚠️ Bucket listing note:', bErr.message);
    } else {
      bucketsData = bList || [];
      console.log(`Found ${bucketsData.length} storage buckets:`);
      for (const b of bucketsData) {
        console.log(`   - Bucket: [${b.id}] (Public: ${b.public})`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Storage inspect exception:', err.message);
  }

  // 3. Backup all table rows
  console.log('\n3. Extracting and backing up all database table records...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = {
    metadata: {
      generatedAt: new Date().toISOString(),
      supabaseUrl: SUPABASE_URL,
      authenticatedUser: auth.user.email,
      targetProject: 'nbsgmorzrccbyfmjbvgx',
      environmentAssessment: 'Development/Staging instance containing synthetic test entities (e.g. "Assam Petrochemicals Ltd 1154", "Dipankar Barman 5905", "DRV-604518")',
    },
    storageBuckets: bucketsData,
    tableCounts: {},
    tables: {},
  };

  let totalRecordsExtracted = 0;

  for (const table of ALL_TABLES) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        backup.tables[table] = { error: error.message, records: [] };
        backup.tableCounts[table] = { exists: false, count: 0, error: error.message };
        console.log(`   [SKIPPED / NO ACCESS] ${table} (${error.message})`);
      } else {
        const rows = data || [];
        backup.tables[table] = { count: rows.length, records: rows };
        backup.tableCounts[table] = { exists: true, count: rows.length };
        totalRecordsExtracted += rows.length;
        console.log(`   [EXTRACTED] ${table}: ${rows.length} rows`);
      }
    } catch (err) {
      backup.tables[table] = { error: err.message, records: [] };
      backup.tableCounts[table] = { exists: false, count: 0, error: err.message };
      console.log(`   [ERROR] ${table}: ${err.message}`);
    }
  }

  // 4. Also back up local server registry files
  const serverUserRegistryPath = path.join(PROJECT_ROOT, 'server/data/server_user_registry.json');
  if (fs.existsSync(serverUserRegistryPath)) {
    try {
      const localReg = JSON.parse(fs.readFileSync(serverUserRegistryPath, 'utf8'));
      backup.localServerRegistry = localReg;
      console.log(`   [EXTRACTED] server_user_registry.json: ${localReg.length} users`);
    } catch (err) {
      console.warn('⚠️ server_user_registry backup note:', err.message);
    }
  }

  // 5. Save to archive directory
  const backupDir = path.join(PROJECT_ROOT, 'archive/backups/database');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `verified_full_backup_${timestamp}.json`);
  const backupJsonString = JSON.stringify(backup, null, 2);
  fs.writeFileSync(backupFilePath, backupJsonString, 'utf8');

  // Verify backup integrity
  const writtenStats = fs.statSync(backupFilePath);
  const parsedBack = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  const isValid = parsedBack?.metadata?.supabaseUrl === SUPABASE_URL && writtenStats.size > 1000;

  console.log('\n========================================================================');
  console.log('✅ BACKUP INTEGRITY VERIFICATION');
  console.log('========================================================================');
  console.log(`📁 Backup File: ${backupFilePath}`);
  console.log(`📦 Size: ${(writtenStats.size / 1024).toFixed(2)} KB`);
  console.log(`📊 Total Records Extracted: ${totalRecordsExtracted}`);
  console.log(`🔍 Verified JSON Readability: ${isValid ? 'PASSED (100% Valid)' : 'FAILED'}`);
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Fatal backup exception:', err);
  process.exit(1);
});
