#!/usr/bin/env node
/**
 * scripts/backup.js
 *
 * Daily backup script: exports critical tables per tenant to Supabase Storage.
 * Called by .github/workflows/daily-backup.yml
 *
 * Tables exported: students, fee_payments (fees), tenants
 * Output: JSON files stored in Supabase Storage bucket 'backups'
 *
 * Required environment variables:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (never anon key)
 *
 * Development-only — NEVER expose service role key in client-side code.
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[Backup] ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TABLES_TO_BACKUP = ['tenants', 'students', 'fees'];
const BACKUP_BUCKET = 'backups';
const DATE_STAMP = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BACKUP_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BACKUP_BUCKET, { public: false });
    if (error) throw new Error(`Failed to create backup bucket: ${error.message}`);
    console.log(`[Backup] Created storage bucket: ${BACKUP_BUCKET}`);
  }
}

async function backupTable(tableName) {
  console.log(`[Backup] Exporting table: ${tableName}`);
  const { data, error } = await supabase.from(tableName).select('*');

  if (error) {
    console.error(`[Backup] ERROR reading ${tableName}:`, error.message);
    return false;
  }

  const jsonContent = JSON.stringify({
    table: tableName,
    exported_at: new Date().toISOString(),
    row_count: data?.length ?? 0,
    rows: data,
  }, null, 2);

  const filePath = `${DATE_STAMP}/${tableName}.json`;
  const { error: uploadError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .upload(filePath, Buffer.from(jsonContent, 'utf-8'), {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    console.error(`[Backup] ERROR uploading ${tableName}:`, uploadError.message);
    return false;
  }

  console.log(`[Backup] ✅ ${tableName}: ${data?.length ?? 0} rows → storage/${BACKUP_BUCKET}/${filePath}`);
  return true;
}

async function main() {
  console.log(`[Backup] Starting daily backup — ${DATE_STAMP}`);

  try {
    await ensureBucket();

    const results = await Promise.allSettled(TABLES_TO_BACKUP.map(backupTable));
    const failures = results.filter((r) => r.status === 'rejected' || r.value === false);

    if (failures.length > 0) {
      console.error(`[Backup] ${failures.length} table(s) failed to back up.`);
      process.exit(1);
    }

    console.log(`[Backup] ✅ All tables backed up successfully.`);
  } catch (err) {
    console.error('[Backup] CRITICAL FAILURE:', err.message);
    process.exit(1);
  }
}

main();
