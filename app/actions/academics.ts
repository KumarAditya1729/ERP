'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'

// Removed getAdminClientAndTenant helper due to N+1 bottleneck

// --- HOMEWORK ACTIONS ---

export async function getTeacherHomeworks() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    const { data, error } = await supabase
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
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    const { title, subject, class_name, due_date, instructions } = formData;

    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('class_name', class_name);

    const { data, error } = await supabase.from('homework_assignments').insert({
      tenant_id: tenantId,
      title,
      subject,
      class_name,
      teacher_name: user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}` : 'Teacher',
      due_date,
      instructions,
      status: 'active',
      total_students: count || 0
    }).select().single();

    if (error) throw error;

    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function gradeSubmission(submissionId: string, score: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    const { error } = await supabase
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
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    const { error } = await supabase
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
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    const { data, error } = await supabase
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
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    
    // add tenant_id to all grades
    const tenantGrades = gradesData.map(g => ({...g, tenant_id: tenantId}));
    
    const { error } = await supabase.from('exams_data').insert(tenantGrades);
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
  if (authErr || !tenantId || !user) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    // 1. Fetch child from parent_links
    const { data: parentLinks } = await supabase
      .from('parent_links')
      .select('student_id')
      .eq('parent_id', user.id);

    let childClass = '10-A';
    let childStudentId: string | null = null;
    if (parentLinks && parentLinks.length > 0) {
      childStudentId = parentLinks[0].student_id;
      const { data: student } = await supabase
        .from('students')
        .select('class_grade, class_name')
        .eq('id', childStudentId)
        .single();
      if (student?.class_grade) childClass = student.class_grade;
    }

    // 2. Fetch recent homework for that child's class
    const { data: homework } = await supabase
      .from('homework_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 3. Fetch real timetable slots for the child's class
    const { data: timetableSlots } = await supabase
      .from('timetable_slots')
      .select('subject, teacher_name, start_time, end_time, room, day_of_week')
      .eq('tenant_id', tenantId)
      .eq('class_name', childClass)
      .order('start_time', { ascending: true })
      .limit(6);

    // 4. Fetch real attendance % for this student
    let attendancePct = 0;
    let assignmentsCompleted = 0;
    let pendingFees = 0;
    let examAverage = 0;

    if (childStudentId) {
      // Attendance
      const { data: attRows } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', childStudentId)
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false })
        .limit(30);
      if (attRows && attRows.length > 0) {
        const present = attRows.filter((r: any) => r.status === 'present').length;
        attendancePct = Math.round((present / attRows.length) * 100);
      }

      // Homework Submissions
      const { count } = await supabase
        .from('homework_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', childStudentId)
        .eq('status', 'submitted');
      assignmentsCompleted = count ?? 0;

      // Fees
      const { data: feeData } = await supabase
        .from('fees')
        .select('amount')
        .eq('student_id', childStudentId)
        .eq('status', 'pending');
      pendingFees = feeData?.reduce((sum, f) => sum + Number(f.amount), 0) || 0;

      // Exams
      const { data: examData } = await supabase
        .from('exams_data')
        .select('marks_obtained, max_marks')
        .eq('student_id', childStudentId);
      if (examData && examData.length > 0) {
        const totalObtained = examData.reduce((sum, e) => sum + Number(e.marks_obtained), 0);
        const totalMax = examData.reduce((sum, e) => sum + Number(e.max_marks), 0);
        examAverage = Math.round((totalObtained / totalMax) * 100);
      }
    }

    return {
      success: true,
      data: {
        homework: homework || [],
        timetable: timetableSlots || [],
        attendance: attendancePct,
        assignmentsCompleted,
        pendingFees,
        examAverage,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
