'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApplication(formData: FormData, docsStatus: any) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient()
  
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error("Profile not found");

  const newApp = {
    tenant_id: profile.tenant_id,
    student_name: formData.get('student_name'),
    date_of_birth: formData.get('date_of_birth'),
    applying_class: formData.get('applying_class'),
    category: formData.get('category'),
    guardian_name: formData.get('guardian_name'),
    guardian_phone: formData.get('guardian_phone'),
    guardian_email: formData.get('guardian_email') || null,
    previous_school: formData.get('previous_school') || null,
    previous_grade: formData.get('previous_grade') || null,
    stage: 'Applied',
    docs_status: docsStatus
  };

  const { error } = await supabase.from('admission_applications').insert(newApp);

  if (error) {
    console.error("Create Application Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function advanceStage(appId: string, nextStage: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };

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
