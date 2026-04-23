'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FeeInvoiceSchema } from '@/lib/validation'
import Razorpay from 'razorpay';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// Setup Rate Limiting
const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 invoice creations per minute
  analytics: true,
}) : null;

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret',
});

export async function createInvoice(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  // Rate Limiting
  if (ratelimit) {
    const { success } = await ratelimit.limit(`create_invoice_${user.id}`);
    if (!success) {
      return { success: false, error: 'Rate limit exceeded. Please wait a minute.' };
    }
  }

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

export async function createRazorpayOrder(invoiceId: string, amountINR: number) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'parent', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const options = {
      amount: amountINR * 100, // Razorpay amount is in paise
      currency: "INR",
      receipt: `receipt_${invoiceId.replace(/-/g, '').slice(0, 30)}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    return { success: true, orderId: order.id };
  } catch (err: any) {
    console.error("Razorpay Order Error:", err);
    return { success: false, error: 'Payment gateway error. Please try again.' };
  }
}

export async function verifyRazorpayPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  invoiceId: string
) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'parent', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret';
  
  // Verify signature
  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generated_signature !== razorpay_signature) {
    return { success: false, error: 'Payment verification failed' };
  }

  // Update DB
  const supabase = createClient();
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
  
  if (!profile) return { success: false, error: 'Profile not found' };

  const { error } = await supabase.from('fees').update({
    status: 'paid',
    payment_method: 'razorpay',
    paid_at: new Date().toISOString()
  }).eq('id', invoiceId).eq('tenant_id', profile.tenant_id);

  if (error) return { success: false, error: error.message };
  
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
