import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  console.log("Checking Supabase Schema...");
  
  // 1. Check if tenants has onboarding columns
  const { data: tenantData, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, onboarding_completed, onboarding_step')
    .limit(1);
    
  if (tenantErr) {
    console.error("❌ Onboarding columns missing on tenants:", tenantErr.message);
  } else {
    console.log("✅ Onboarding columns exist on tenants");
  }

  // 2. Check academic_years
  const { data: acYear, error: acErr } = await supabase.from('academic_years').select('id').limit(1);
  if (acErr) {
    console.error("❌ academic_years table missing:", acErr.message);
  } else {
    console.log("✅ academic_years table exists");
  }

  // 3. Check staff_invites
  const { data: si, error: siErr } = await supabase.from('staff_invites').select('id').limit(1);
  if (siErr) {
    console.error("❌ staff_invites table missing:", siErr.message);
  } else {
    console.log("✅ staff_invites table exists");
  }

  // 4. Check webhook_events
  const { data: we, error: weErr } = await supabase.from('webhook_events').select('id').limit(1);
  if (weErr) {
    console.error("❌ webhook_events table missing:", weErr.message);
  } else {
    console.log("✅ webhook_events table exists");
  }

  // 5. Check delete_tenant_data function
  const { error: fnErr } = await supabase.rpc('delete_tenant_data', { target_tenant_id: '00000000-0000-0000-0000-000000000000' });
  if (fnErr && fnErr.code !== 'P0001' && fnErr.message.includes('Could not find')) {
    console.error("❌ delete_tenant_data function missing:", fnErr.message);
  } else {
    console.log("✅ delete_tenant_data function exists (or fails with expected error)");
  }
}

check();
