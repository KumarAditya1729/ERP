'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache'

export async function getTeacherStudents(classGrade: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };

  try {
    let query = supabaseAdmin
      .from('students')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('first_name', { ascending: true });
      
    if (classGrade && classGrade !== 'all') {
      query = query.eq('class_grade', classGrade);
    }
      
    const { data: students, error } = await query;

    if (error) throw error;
    return { success: true, data: students };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addStudent(formData: FormData) {
  const supabase = createClient()
  
  // Get current user and tenant
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error("Profile not found");

  const newStudent = {
    tenant_id: profile.tenant_id,
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    class_grade: formData.get('class_grade'),
    section: formData.get('section'),
    roll_number: formData.get('roll_number') || null,
    guardian_name: formData.get('guardian_name'),
    guardian_phone: formData.get('guardian_phone'),
    status: formData.get('status') || 'active'
  };

  const { error } = await supabase.from('students').insert(newStudent);
  
  if (error) {
    console.error("Add Student Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/students');
  return { success: true };
}

export async function updateStudent(id: string, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error("Profile not found");

  // SECURITY: Verify the student belongs to this tenant before updating (prevents cross-tenant mutation)
  const { data: existing } = await supabase.from('students').select('tenant_id').eq('id', id).single();
  if (!existing || existing.tenant_id !== profile.tenant_id) {
    return { success: false, error: 'Forbidden: student not found in your organization' };
  }
  
  const updates = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    class_grade: formData.get('class_grade'),
    section: formData.get('section'),
    roll_number: formData.get('roll_number') || null,
    guardian_name: formData.get('guardian_name'),
    guardian_phone: formData.get('guardian_phone'),
    status: formData.get('status')
  };

  const { error } = await supabase.from('students').update(updates).eq('id', id).eq('tenant_id', profile.tenant_id);

  if (error) {
    console.error("Update Student Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/students');
  return { success: true };
}

export async function deleteStudent(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) {
    return { success: false, error: error.message };
  }
  revalidatePath('/dashboard/students');
  return { success: true };
}
