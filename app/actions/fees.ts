'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FeeInvoiceSchema } from '@/lib/validation'

export async function createInvoice(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient()
  
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error("Profile not found");

  const parseResult = FeeInvoiceSchema.safeParse({
    student_id: formData.get('student_id'),
    title: formData.get('title'),
    amount: formData.get('amount'),
    due_date: formData.get('due_date'),
  });

  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0].message };
  }

  const newInvoice = {
    tenant_id: profile.tenant_id,
    ...parseResult.data,
    invoice_number: `INV-${profile.tenant_id.slice(0, 8).toUpperCase()}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    status: 'pending',
    payment_method: null
  };

  const { error } = await supabase.from('fees').insert(newInvoice);

  if (error) {
    console.error("Create Invoice Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateInvoiceStatus(id: string, status: string, paymentMethod: string | null = null) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: 'Profile not found' };

  const updates: any = { status };
  if (paymentMethod) updates.payment_method = paymentMethod;
  if (status === 'paid') updates.paid_at = new Date().toISOString();

  const { error } = await supabase.from('fees').update(updates).eq('id', id).eq('tenant_id', profile.tenant_id);
  if (error) return { success: false, error: error.message };
  
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function sendFeeReminders(invoiceIds: string[]) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) return { success: false, error: "Profile not found" };

  const notice = {
    tenant_id: profile.tenant_id,
    title: '⚠️ Critical Fee Reminder',
    raw_content: `This is an automated reminder regarding pending fee invoice(s). Please check your fees dashboard to process the payment immediately via Razorpay to avoid compound late penalties.`,
    channel: 'sms',
    target_roles: ['parent']
  };

  const { error } = await supabase.from('notices').insert(notice);
  if (error) return { success: false, error: error.message };

  return { success: true, count: invoiceIds.length };
}
