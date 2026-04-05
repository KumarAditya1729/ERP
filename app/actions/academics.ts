'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache'

async function getAdminClientAndTenant() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) throw new Error('Profile not found');

  return { supabaseAdmin, profile, tenantId: profile.tenant_id as string };
}

// --- HOMEWORK ACTIONS ---

export async function getTeacherHomeworks() {
  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    const { data, error } = await supabaseAdmin
      .from('homework_assignments')
      .select('*, homework_submissions(count)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createHomeworkAssignment(formData: any) {
  try {
    const { supabaseAdmin, profile, tenantId } = await getAdminClientAndTenant();
    const { title, subject, class_name, due_date, instructions } = formData;

    const { data, error } = await supabaseAdmin.from('homework_assignments').insert({
      tenant_id: tenantId,
      title,
      subject,
      class_name,
      teacher_name: profile.first_name + ' ' + (profile.last_name || ''),
      due_date,
      instructions,
      status: 'active',
      total_students: 30 // MVP default
    }).select().single();

    if (error) throw error;

    // Auto generate mock submissions for demo purposes if it is an MVP
    const mockStudents = ['Aarav Patel', 'Priya Sharma', 'Riya Mehta', 'Karan Singh', 'Sneha Gupta'];
    const mockSubs = mockStudents.map(name => ({
      tenant_id: tenantId,
      assignment_id: data.id,
      student_name: name,
      class_name: class_name,
      status: Math.random() > 0.5 ? 'missing' : 'pending',
      submitted_at: Math.random() > 0.5 ? new Date().toISOString() : null
    }));
    await supabaseAdmin.from('homework_submissions').insert(mockSubs);

    revalidatePath('/dashboard/homework');
    revalidatePath('/teacher/homework');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function gradeSubmission(submissionId: string, score: string) {
  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    const { error } = await supabaseAdmin
      .from('homework_submissions')
      .update({ status: 'graded', score })
      .eq('id', submissionId)
      .eq('tenant_id', tenantId);
      
    if (error) throw error;
    revalidatePath('/dashboard/homework');
    revalidatePath('/teacher/homework');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAssignmentStatus(assignmentId: string, status: string) {
  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    const { error } = await supabaseAdmin
      .from('homework_assignments')
      .update({ status })
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId);
      
    if (error) throw error;
    revalidatePath('/dashboard/homework');
    revalidatePath('/teacher/homework');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- EXAM ACTIONS ---

export async function getTeacherExams() {
  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    const { data, error } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('exam_date', { ascending: true });
      
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitExamGrades(gradesData: any[]) {
  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    
    // add tenant_id to all grades
    const tenantGrades = gradesData.map(g => ({...g, tenant_id: tenantId}));
    
    const { error } = await supabaseAdmin.from('exams_data').insert(tenantGrades);
    if (error) throw error;
    
    revalidatePath('/dashboard/exams');
    revalidatePath('/teacher/exams');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
