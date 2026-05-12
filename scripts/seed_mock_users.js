require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// We will use the Tenant ID created from seed_tenant.js
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockAccounts = [
  { email: 'admin@nexschool.local', password: 'Password!123', role: 'admin', firstName: 'Admin', lastName: 'Master' },
  { email: 'teacher@nexschool.local', password: 'Password!123', role: 'teacher', firstName: 'Teacher', lastName: 'Sarah' },
  { email: 'staff@nexschool.local', password: 'Password!123', role: 'staff', firstName: 'Staff', lastName: 'Manager' },
  { email: 'parent@nexschool.local', password: 'Password!123', role: 'parent', firstName: 'Parent', lastName: 'John' },
  { email: 'student@nexschool.local', password: 'Password!123', role: 'student', firstName: 'Student', lastName: 'Tim' }
];

async function seedMockUsers() {
  console.log('🌱 Seeding Mock User Accounts...');
  for (const acc of mockAccounts) {
    console.log(`\nCreating ${acc.role} account...`);
    
    // 1. Create User in Supabase Auth via Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { 
        first_name: acc.firstName, 
        last_name: acc.lastName, 
        role: acc.role,
        tenant_id: TENANT_ID 
      },
      app_metadata: { 
        role: acc.role,
        tenant_id: TENANT_ID
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`⚠️ User ${acc.email} already exists. Skipping auth creation.`);
      } else {
        console.error(`❌ Failed to create auth user for ${acc.email}:`, authError.message);
        continue;
      }
    } else {
      console.log(`✅ Auth user created securely. ID: ${authData.user.id}`);
      
      // 2. Map Profile Data in public schema
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        first_name: acc.firstName,
        last_name: acc.lastName,
        email: acc.email,
        role: acc.role,
        tenant_id: TENANT_ID
      });

      if (profileError) {
        console.error(`❌ Failed to assign profile for ${acc.email}:`, profileError.message);
      } else {
        console.log(`✅ Profile linked perfectly to Tenant ${TENANT_ID}`);
      }
    }
  }
  
  console.log('\n✅ Seeding Complete! Passwords for all accounts: Password!123');
}

seedMockUsers();
