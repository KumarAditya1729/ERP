'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

import { staffSchema } from '@/lib/validations/schemas';

export async function addStaff(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient()
  
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };

  const rawData = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    role: formData.get('role') as string,
    department: formData.get('department') as string || 'General',
    salary: formData.get('salary') || '0',
    email: formData.get('email') as string,
  };

  const validationResult = staffSchema.safeParse(rawData);
  if (!validationResult.success) {
    return { 
      success: false, 
      error: 'Validation failed: ' + validationResult.error.errors.map(e => e.message).join(', ') 
    };
  }

  const { first_name, last_name, role, department, salary, email } = validationResult.data;
  
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
    first_name: first_name,
    last_name: last_name,
    role: role,
    email: email,
    salary: salary,
    department: department
  });

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
