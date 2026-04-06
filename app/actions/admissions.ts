'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApplication(formData: FormData, docsStatus: any) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
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

  revalidatePath('/dashboard/admissions');
  return { success: true };
}

export async function advanceStage(appId: string, nextStage: string) {
  const supabase = createClient();
  const { error } = await supabase.from('admission_applications').update({ stage: nextStage }).eq('id', appId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/dashboard/admissions');
  return { success: true };
}

export async function updateDocs(appId: string, docsStatus: any) {
  const supabase = createClient();
  const { error } = await supabase.from('admission_applications').update({ docs_status: docsStatus }).eq('id', appId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/dashboard/admissions');
  return { success: true };
}

export async function updateDocFile(appId: string, docKey: string, filePath: string) {
  const supabase = createClient();
  
  const { data: app, error: fetchErr } = await supabase.from('admission_applications').select('docs_status, document_files').eq('id', appId).single();
  if (fetchErr || !app) return { success: false, error: fetchErr?.message || 'App not found' };

  const updatedDocsStatus = { ...(app.docs_status || {}), [docKey]: true };
  const updatedDocFiles = { ...(app.document_files || {}), [docKey]: filePath };

  const { error } = await supabase.from('admission_applications').update({ 
    docs_status: updatedDocsStatus,
    document_files: updatedDocFiles
  }).eq('id', appId);
  
  if (error) return { success: false, error: error.message };
  revalidatePath('/dashboard/admissions');
  return { success: true };
}
