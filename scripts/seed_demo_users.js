require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function seedUser(email, role) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Admin1234!',
    email_confirm: true,
    user_metadata: {
      first_name: 'Demo',
      last_name: role.charAt(0).toUpperCase() + role.slice(1),
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      role: role
    },
    app_metadata: {
      role: role,
      tenant_id: '550e8400-e29b-41d4-a716-446655440000'
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
        console.log(`✅ ${email} is already registered.`);
    } else {
        console.error(`❌ Error creating ${email}:`, error.message);
    }
  } else {
    console.log(`🎉 Created ${email} correctly as ${role}`);
  }
}

async function run() {
  console.log("Seeding Demo Users...");
  await seedUser('admin_v3@nexschool.com', 'admin');
  await seedUser('teacher_v3@nexschool.com', 'teacher');
  await seedUser('parent_v3@nexschool.com', 'parent');
  await seedUser('staff_v3@nexschool.com', 'staff');
  await seedUser('student_v3@nexschool.com', 'student');
  console.log("Finished.");
}

run();
