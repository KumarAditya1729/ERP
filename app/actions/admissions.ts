'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';

// Setup Rate Limiting
const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 apps per minute
  analytics: true,
}) : null;

const admissionSchema = z.object({
  student_name: z.string().min(2),
  date_of_birth: z.string(),
  applying_class: z.string(),
  category: z.string(),
  guardian_name: z.string(),
  guardian_phone: z.string().min(10),
  guardian_email: z.string().email().optional().or(z.literal('')),
  previous_school: z.string().optional(),
  previous_grade: z.string().optional(),
});

export async function createApplication(formData: FormData, docsStatus: any) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  // Rate Limiting
  if (ratelimit) {
    const { success } = await ratelimit.limit(`admission_${user.id}`);
    if (!success) return { success: false, error: 'Rate limit exceeded.' };
  }

  const supabase = createClient()
  
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error("Profile not found");

  const parsed = admissionSchema.safeParse({
    student_name: formData.get('student_name'),
    date_of_birth: formData.get('date_of_birth'),
    applying_class: formData.get('applying_class'),
    category: formData.get('category'),
    guardian_name: formData.get('guardian_name'),
    guardian_phone: formData.get('guardian_phone'),
    guardian_email: formData.get('guardian_email') || '',
    previous_school: formData.get('previous_school') || '',
    previous_grade: formData.get('previous_grade') || '',
  });

  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const newApp = {
    tenant_id: profile.tenant_id,
    ...parsed.data,
    stage: 'Applied',
    docs_status: docsStatus
  };

  const { data, error } = await supabase.from('admission_applications').insert(newApp).select('id').single();
  if (error) return { success: false, error: error.message };

  revalidatePath('/', 'layout');
  return { success: true, id: data.id };
}

export async function advanceStage(appId: string, nextStage: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };

  // If enrolling, insert into students table
  if (nextStage === 'Enrolled') {
    const { data: app } = await supabase.from('admission_applications').select('*').eq('id', appId).eq('tenant_id', profile.tenant_id).single();
    if (app) {
      const names = app.student_name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || 'Student';
      
      const { error: stuErr } = await supabase.from('students').insert({
        tenant_id: profile.tenant_id,
        first_name: firstName,
        last_name: lastName,
        class_grade: app.applying_class,
        section: 'A', // Default assignment
        guardian_name: app.guardian_name,
        guardian_phone: app.guardian_phone,
        status: 'active'
      });
      if (stuErr) return { success: false, error: 'Failed to create student record: ' + stuErr.message };
    }
  }

  const { error } = await supabase.from('admission_applications').update({ stage: nextStage }).eq('id', appId).eq('tenant_id', profile.tenant_id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateDocs(appId: string, docsStatus: any) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };

  const { error } = await supabase.from('admission_applications').update({ docs_status: docsStatus }).eq('id', appId).eq('tenant_id', profile.tenant_id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateDocFile(appId: string, docKey: string, filePath: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  // Rate Limiting
  if (ratelimit) {
    const { success } = await ratelimit.limit(`doc_upload_${user.id}`);
    if (!success) return { success: false, error: 'Upload rate limit exceeded.' };
  }

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };
  
  const { data: app, error: fetchErr } = await supabase.from('admission_applications').select('docs_status, document_files').eq('id', appId).eq('tenant_id', profile.tenant_id).single();
  if (fetchErr || !app) return { success: false, error: fetchErr?.message || 'App not found' };

  const updatedDocsStatus = { ...(app.docs_status || {}), [docKey]: true };
  const updatedDocFiles = { ...(app.document_files || {}), [docKey]: filePath };

  const { error } = await supabase.from('admission_applications').update({ 
    docs_status: updatedDocsStatus,
    document_files: updatedDocFiles
  }).eq('id', appId).eq('tenant_id', profile.tenant_id);
  
  if (error) return { success: false, error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
