const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or Service Role Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  console.log("Seeding demo data...");

  // 1. Create a Demo Tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert([{
      name: 'NexSchool Demo',
      subdomain: 'nexschool', // Used for slug/subdomain
      slug: 'nexschool', // Note: might be 'slug' or 'subdomain' based on your DB, we'll try both or check schema
      status: 'active'
    }])
    .select('id')
    .single();

  let tenantId;
  if (tenantError) {
    if (tenantError.code === '23505' || tenantError.code === '42703') { 
      // If already exists or column doesn't exist, just fetch one
      console.log("Tenant might already exist or schema difference, fetching first tenant...");
      const { data: existing } = await supabase.from('tenants').select('id').limit(1).single();
      tenantId = existing?.id;
    } else {
      console.error("Error creating tenant:", tenantError);
      process.exit(1);
    }
  } else {
    tenantId = tenant.id;
  }

  if (!tenantId) {
    console.error("Could not determine tenant ID!");
    process.exit(1);
  }
  
  console.log("Using Tenant ID:", tenantId);

  const users = [
    { email: 'admin_v3@nexschool.com', role: 'admin' },
    { email: 'teacher_v3@nexschool.com', role: 'teacher' },
    { email: 'parent_v3@nexschool.com', role: 'parent' },
    { email: 'staff_v3@nexschool.com', role: 'staff' },
  ];

  for (const u of users) {
    const { data: user, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'Admin1234!',
      email_confirm: true,
      user_metadata: {
        role: u.role,
        tenant_id: tenantId,
        first_name: u.role.charAt(0).toUpperCase() + u.role.slice(1),
        last_name: 'Demo'
      },
      app_metadata: {
        role: u.role,
        tenant_id: tenantId
      }
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`User ${u.email} already exists, updating metadata...`);
        // We could fetch and update, but let's just log it
      } else {
        console.error(`Error creating ${u.email}:`, error);
      }
    } else {
      console.log(`✅ Created ${u.email} (${u.role})`);
    }
  }

  console.log("Done seeding!");
}

seed();
