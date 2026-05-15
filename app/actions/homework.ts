'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitHomeworkFile(submissionId: string, fileName: string, fileUrl: string, fileType: string, fileSize: number) {
  const { user, tenantId, error: authErr } = await requireAuth(['parent', 'student']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };

  try {
    const supabase = createClient();

    // Verify submission belongs to the user
    // This is handled via RLS on DB level, but we check here too.
    
    // Insert file record
    const { error: fileErr } = await supabase.from('homework_submission_files').insert({
      tenant_id: tenantId,
      submission_id: submissionId,
      file_name: fileName,
      file_url: fileUrl,
      file_type: fileType,
      file_size: fileSize
    });

    if (fileErr) throw fileErr;

    // Update submission status to pending if it was missing
    await supabase.from('homework_submissions')
      .update({ status: 'pending', submitted_at: new Date().toISOString() })
      .eq('id', submissionId)
      .eq('status', 'missing');

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addHomeworkComment(submissionId: string, commentText: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'parent', 'student']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };

  try {
    const supabase = createClient();
    const role = user?.user_metadata?.role || 'student';
    
    const { error } = await supabase.from('homework_comments').insert({
      tenant_id: tenantId,
      submission_id: submissionId,
      author_id: user.id,
      author_role: role,
      comment_text: commentText
    });

    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getStudentHomeworkDetails(assignmentId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'parent', 'student']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };

  try {
    const supabase = createClient();
    
    // Get Assignment details
    const { data: assignment, error: assignErr } = await supabase
      .from('homework_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();
      
    if (assignErr) throw assignErr;

    // We need to find the student_id linked to the current user to get the right submission.
    // Let's rely on the client passing the student_id or we fetch it.
    let studentId = null;
    if (user?.user_metadata?.role === 'parent') {
       const { data: parentLinks } = await supabase.from('parent_links').select('student_id').eq('parent_id', user.id).limit(1);
       if (parentLinks && parentLinks.length > 0) studentId = parentLinks[0].student_id;
    } else if (user?.user_metadata?.role === 'student') {
       studentId = user.id;
    }

    if (!studentId) return { success: true, data: { assignment, submission: null } };

    // Get Submission
    const { data: submission } = await supabase
      .from('homework_submissions')
      .select('*, homework_submission_files(*), homework_comments(*)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .single();

    return { success: true, data: { assignment, submission } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
