'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function addStaff(formData: FormData) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error("Profile not found");

  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  
  // Create user in Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'password123', // Initial generic password
    email_confirm: true,
    user_metadata: { role, tenant_id: profile.tenant_id }
  });

  if (authError || !authData.user) {
    console.error("Auth creation failed:", authError);
    return { success: false, error: authError?.message || "Auth error" };
  }

  // Ensure profile is synced properly
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    tenant_id: profile.tenant_id,
    first_name: firstName,
    last_name: lastName,
    role: role,
    email: email
  });

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
