'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createInvoice(formData: FormData) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error("Profile not found");

  const newInvoice = {
    tenant_id: profile.tenant_id,
    student_id: formData.get('student_id'),
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    title: formData.get('title'),
    amount: formData.get('amount'),
    due_date: formData.get('due_date'),
    status: 'pending',
    payment_method: null
  };

  const { error } = await supabase.from('fees').insert(newInvoice);

  if (error) {
    console.error("Create Invoice Error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/fees');
  return { success: true };
}

export async function updateInvoiceStatus(id: string, status: string, paymentMethod: string | null = null) {
  const supabase = createClient();
  const updates: any = { status };
  if (paymentMethod) updates.payment_method = paymentMethod;

  const { error } = await supabase.from('fees').update(updates).eq('id', id);
  if (error) return { success: false, error: error.message };
  
  revalidatePath('/dashboard/fees');
  return { success: true };
}

export async function sendFeeReminders(invoiceIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
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
