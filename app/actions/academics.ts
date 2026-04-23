'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'

async function getAdminClientAndTenant() {
  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error('Unauthorized');

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error('Profile not found');

  return { supabaseAdmin, profile, tenantId: profile.tenant_id as string };
}

// --- HOMEWORK ACTIONS ---

export async function getTeacherHomeworks() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

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
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

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

    // Removed mock data insertion for production safety
    // In production, real students would be fetched and submissions initialized directly or populated lazily.

    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function gradeSubmission(submissionId: string, score: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    const { error } = await supabaseAdmin
      .from('homework_submissions')
      .update({ status: 'graded', score })
      .eq('id', submissionId)
      .eq('tenant_id', tenantId);
      
    if (error) throw error;
    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAssignmentStatus(assignmentId: string, status: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    const { error } = await supabaseAdmin
      .from('homework_assignments')
      .update({ status })
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId);
      
    if (error) throw error;
    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- EXAM ACTIONS ---

export async function getTeacherExams() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

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
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    
    // add tenant_id to all grades
    const tenantGrades = gradesData.map(g => ({...g, tenant_id: tenantId}));
    
    const { error } = await supabaseAdmin.from('exams_data').insert(tenantGrades);
    if (error) throw error;
    
    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getParentAcademics() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff', 'parent', 'student']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId, profile } = await getAdminClientAndTenant();

    // 1. Fetch child from parent_links
    const { data: parentLinks } = await supabaseAdmin.from('parent_links').select('student_id').eq('parent_id', user.id);
    let childClass = '10-A'; // Default fallback
    if (parentLinks && parentLinks.length > 0) {
      const { data: student } = await supabaseAdmin.from('students').select('class_grade').eq('id', parentLinks[0].student_id).single();
      if (student && student.class_grade) childClass = student.class_grade;
    }

    // 2. Fetch homework for that class
    const { data: homework } = await supabaseAdmin
      .from('homework_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      // For demo, we just fetch all if no specific class match, or match class
      .order('created_at', { ascending: false })
      .limit(5);

    // 3. Mock timetable (since no timetable table exists in ERP schema yet)
    const timetable = [
      { subject: 'Mathematics', teacher: 'Priya Sharma', time: '09:00 AM - 09:45 AM', room: 'Room 201', status: 'completed' },
      { subject: 'Physics', teacher: 'Vikram Singh', time: '09:50 AM - 10:35 AM', room: 'Lab 3', status: 'active' },
      { subject: 'English', teacher: 'Sarah Jenkins', time: '10:50 AM - 11:35 AM', room: 'Room 105', status: 'upcoming' },
    ];

    return { 
      success: true, 
      data: {
        homework: homework || [],
        timetable,
        attendance: 94,
        assignmentsCompleted: 88
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
