import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
  const adminV3 = users?.users.find(u => u.email === 'admin_v3@nexschool.com');
  
  if (!adminV3) {
    console.log("admin_v3 not found!");
    return;
  }
  
  console.log("admin_v3 id:", adminV3.id);
  console.log("admin_v3 app_metadata:", adminV3.app_metadata);
  console.log("admin_v3 user_metadata:", adminV3.user_metadata);
  
  const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', adminV3.id);
  console.log("Profile error:", profErr);
  console.log("Profile:", profile);
}

check();
