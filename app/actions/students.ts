'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'
import { StudentSchema } from '@/lib/validation';

export async function getTeacherStudents(classGrade: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();

  try {
    let query = supabase
      .from('students')
      .select('*')
      .eq('tenant_id', tenantId)
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

import { studentSchema } from '@/lib/validations/schemas';

export async function addStudent(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();

  const rawData = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    class_grade: formData.get('class_grade') as string,
    section: formData.get('section') as string,
    roll_number: formData.get('roll_number') as string,
    guardian_name: formData.get('guardian_name') as string,
    guardian_phone: formData.get('guardian_phone') as string,
    email: formData.get('email') as string,
  };

  const validationResult = StudentSchema.safeParse(rawData);
  if (!validationResult.success) {
    return { 
      success: false, 
      error: 'Validation failed: ' + validationResult.error.errors.map(e => e.message).join(', ') 
    };
  }

  const newStudent = {
    ...validationResult.data,
    tenant_id: tenantId,
    status: 'active',
  };

  const { error } = await supabase.from('students').insert(newStudent);
  
  if (error) {
    console.error("Add Student Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateStudent(id: string, formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient()

  // SECURITY: Verify the student belongs to this tenant before updating (prevents cross-tenant mutation)
  // And relies on Supabase client RLS for safety
  const { data: existing } = await supabase.from('students').select('tenant_id').eq('id', id).single();
  if (!existing || existing.tenant_id !== tenantId) {
    return { success: false, error: 'Forbidden: student not found in your organization' };
  }
  
  const parseResult = StudentSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    class_grade: formData.get('class_grade'),
    section: formData.get('section'),
    roll_number: formData.get('roll_number') || undefined,
    guardian_name: formData.get('guardian_name') || undefined,
    guardian_phone: formData.get('guardian_phone') || undefined,
    email: formData.get('email') || undefined,
  });

  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0].message };
  }

  const updates = {
    ...parseResult.data,
    status: formData.get('status')
  };

  const { error } = await supabase.from('students').update(updates).eq('id', id).eq('tenant_id', tenantId);

  if (error) {
    console.error("Update Student Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteStudent(id: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();

  const { error } = await supabase.from('students').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) {
    return { success: false, error: error.message };
  }
  revalidatePath('/', 'layout');
  return { success: true };
}
