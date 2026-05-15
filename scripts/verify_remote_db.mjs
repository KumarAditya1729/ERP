import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 Checking remote Supabase database for new tables...\n');
  
  const tablesToCheck = [
    // Phase 1: Homework
    'homework_submission_files',
    'homework_comments',
    
    // Phase 2: Hostel
    'hostel_gate_passes',
    
    // Phase 3: HR
    'hr_leave_requests',
    'hr_payslips',
    
    // Phase 4: Attendance & Comms
    'attendance_bulk_logs',
    'notice_deliveries',
    
    // Phase 5: Audit & GPS (Checking earlier ones)
    'audit_logs',
    'gps_vehicles'
  ];

  let allExist = true;

  for (const table of tablesToCheck) {
    // We do a simple select with limit 1 to see if it throws an error
    const { error } = await supabase.from(table).select('*').limit(1);
    
    if (error && error.code === '42P01') { // 42P01 = undefined_table in Postgres
      console.log(`❌ Table Missing: ${table}`);
      allExist = false;
    } else if (error) {
       console.log(`⚠️  Table ${table} exists, but got error: ${error.message}`);
    } else {
      console.log(`✅ Table Exists: ${table}`);
    }
  }

  console.log('\n----------------------------------------');
  if (allExist) {
    console.log('🎉 ALL TABLES FOUND! The database schema is fully deployed.');
  } else {
    console.log('⚠️  SOME TABLES ARE MISSING. The SQL might not have run completely.');
  }
}

checkTables();
