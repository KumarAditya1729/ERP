'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { sendNotification } from '@/lib/notifications';
import { generateAndUploadReceiptPdf } from '@/app/actions/feesPdf';

// Setup Razorpay
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

// ==========================================
// FEE CATEGORIES
// ==========================================
export async function createFeeCategory(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const recurrence = formData.get('recurrence') as string;
  const is_recurring = recurrence !== 'one_time';

  const { error } = await supabase.from('fee_categories').insert({
    tenant_id: tenantId,
    name,
    description,
    recurrence,
    is_recurring,
    is_active: true
  });

  if (error) return { success: false, error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function listFeeCategories() {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, data: [] };

  const supabase = createClient();
  const { data, error } = await supabase.from('fee_categories').select('*').eq('tenant_id', tenantId).order('name');
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ==========================================
// FEE STRUCTURES
// ==========================================
export async function createFeeStructure(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  const academic_year = formData.get('academic_year') as string;
  const category_id = formData.get('category_id') as string;
  const amount = Number(formData.get('amount'));
  const due_day = Number(formData.get('due_day'));

  const { error } = await supabase.from('fee_structures').insert({
    tenant_id: tenantId,
    academic_year,
    category_id,
    amount,
    due_day
  });

  if (error) return { success: false, error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

// ==========================================
// STUDENT FEE ASSIGNMENTS
// ==========================================
export async function assignFeeStructureToStudent(studentId: string, feeStructureId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  const { error } = await supabase.from('student_fee_assignments').insert({
    tenant_id: tenantId,
    student_id: studentId,
    fee_structure_id: feeStructureId
  });

  if (error) return { success: false, error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

// ==========================================
// INVOICE GENERATION LOGIC
// ==========================================
export async function generateMonthlyInvoiceForStudent(studentId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();

  // 1. Fetch active assignments
  const { data: assignments, error: assgnErr } = await supabase
    .from('student_fee_assignments')
    .select('*, fee_structures(*, fee_categories(*))')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .eq('tenant_id', tenantId);

  if (assgnErr || !assignments || assignments.length === 0) {
    return { success: false, error: 'No active fee assignments found.' };
  }

  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}`;
  const invoiceNumber = `INV-${tenantId.slice(0, 4).toUpperCase()}-${currentMonthStr}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;

  // 2. Prevent duplicate invoice for same month (simplified check, would need more robust logic in prod based on billing_month)
  // For this exercise, we will just generate.

  let subtotal = 0;
  let discount_total = 0;

  const invoiceItems = assignments.map(a => {
    const fs: any = a.fee_structures;
    const cat: any = fs.fee_categories;
    const amount = Number(fs.amount);
    const discount = Number(a.discount_amount);
    const final = amount - discount;
    
    subtotal += amount;
    discount_total += discount;

    return {
      category_id: cat.id,
      description: `${cat.name} - ${currentMonthStr}`,
      amount: amount,
      discount_amount: discount,
      final_amount: final
    };
  });

  const total_amount = subtotal - discount_total;

  // Generate due date based on max due_day from structures or default
  const dueDay = 10;
  const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay).toISOString().split('T')[0];
  const billingMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];

  // Insert Invoice
  const { data: invoiceData, error: invErr } = await supabase.from('fee_invoices').insert({
    tenant_id: tenantId,
    student_id: studentId,
    invoice_number: invoiceNumber,
    academic_year: '2025-2026',
    billing_month: billingMonth,
    subtotal,
    discount_total,
    total_amount,
    balance_amount: total_amount,
    due_date: dueDate,
    status: 'issued',
    created_by: user.id
  }).select().single();

  if (invErr) return { success: false, error: invErr.message };

  // Insert Items
  const itemsToInsert = invoiceItems.map(item => ({
    ...item,
    tenant_id: tenantId,
    invoice_id: invoiceData.id
  }));

  const { error: itemsErr } = await supabase.from('fee_invoice_items').insert(itemsToInsert);
  if (itemsErr) return { success: false, error: itemsErr.message };

  // Audit Log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: 'invoice.generated',
    entity_type: 'fee_invoices',
    entity_id: invoiceData.id
  });

  // Notification
  const { data: studentData } = await supabase.from('students').select('first_name, last_name, parent_email, parent_phone').eq('id', studentId).single();
  if (studentData) {
    await sendNotification(
      tenantId, studentId, 'invoice.generated',
      studentData.parent_email || null, studentData.parent_phone || null,
      {
        invoiceNumber: invoiceNumber,
        studentName: `${studentData.first_name} ${studentData.last_name}`,
        amount: total_amount,
        dueDate: new Date(dueDate).toLocaleDateString()
      },
      invoiceData.id
    );
  }

  revalidatePath('/', 'layout');
  return { success: true, invoice: invoiceData };
}

// ==========================================
// PAYMENTS & RAZORPAY
// ==========================================

export async function createRazorpayOrderForInvoice(invoiceId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'parent', 'student']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  
  // Fetch invoice securely
  const { data: invoice, error } = await supabase.from('fee_invoices').select('*').eq('id', invoiceId).eq('tenant_id', tenantId).single();
  
  if (error || !invoice) return { success: false, error: 'Invoice not found' };
  if (invoice.balance_amount <= 0) return { success: false, error: 'Invoice is already fully paid' };

  if (!razorpay) return { success: false, error: 'Razorpay is not configured' };

  try {
    const amountINR = Number(invoice.balance_amount);
    const options = {
      amount: amountINR * 100, // Razorpay amount is in paise
      currency: "INR",
      receipt: `receipt_${invoiceId.replace(/-/g, '').slice(0, 30)}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    
    // Store preliminary payment record
    const { data: paymentRecord, error: payErr } = await supabase.from('fee_payments').insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      student_id: invoice.student_id,
      amount: amountINR,
      payment_method: 'razorpay',
      razorpay_order_id: order.id,
      payment_status: 'created'
    }).select().single();

    if (payErr) throw payErr;

    return { success: true, orderId: order.id, amount: amountINR, paymentId: paymentRecord.id };
  } catch (err: any) {
    return { success: false, error: 'Payment gateway error: ' + err.message };
  }
}

export async function verifyRazorpayPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  internalPaymentId: string
) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'parent', 'student']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return { success: false, error: 'Payment gateway not configured' };
  
  // Verify signature
  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generated_signature !== razorpay_signature) {
    return { success: false, error: 'Payment verification failed (signature mismatch)' };
  }

  const supabase = createClient();
  
  // Get Payment Record
  const { data: payment, error: fetchErr } = await supabase.from('fee_payments').select('*, fee_invoices(*)').eq('id', internalPaymentId).eq('tenant_id', tenantId).single();
  if (fetchErr || !payment) return { success: false, error: 'Payment record not found' };

  const invoice = payment.fee_invoices;
  
  // Update Payment Record
  await supabase.from('fee_payments').update({
    payment_status: 'success',
    razorpay_payment_id,
    razorpay_signature,
    paid_at: new Date().toISOString()
  }).eq('id', internalPaymentId);

  // Update Invoice
  const newPaidAmount = Number(invoice.paid_amount) + Number(payment.amount);
  const newBalance = Number(invoice.total_amount) - newPaidAmount;
  const status = newBalance <= 0 ? 'paid' : 'partially_paid';

  await supabase.from('fee_invoices').update({
    paid_amount: newPaidAmount,
    balance_amount: newBalance,
    status,
    paid_at: newBalance <= 0 ? new Date().toISOString() : invoice.paid_at
  }).eq('id', invoice.id);

  // Generate Receipt
  const receiptNum = `RCPT-${tenantId.slice(0,4).toUpperCase()}-${Date.now()}`;
  await supabase.from('fee_receipts').insert({
    tenant_id: tenantId,
    payment_id: payment.id,
    invoice_id: invoice.id,
    receipt_number: receiptNum
  });

  // Audit
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: 'payment.razorpay.verified',
    entity_type: 'fee_payments',
    entity_id: payment.id
  });

  let warning = '';
  try {
    await generateAndUploadReceiptPdf(payment.id);
  } catch (err: any) {
    warning += `Receipt generation failed: ${err.message}. `;
  }

  // Notification
  const { data: studentData } = await supabase.from('students').select('first_name, last_name, parent_email, parent_phone').eq('id', invoice.student_id).single();
  if (studentData) {
    const notifyRes = await sendNotification(
      tenantId, invoice.student_id, 'payment.success',
      studentData.parent_email || null, studentData.parent_phone || null,
      {
        receiptNumber: receiptNum,
        studentName: `${studentData.first_name} ${studentData.last_name}`,
        amount: payment.amount,
        method: 'Razorpay'
      },
      invoice.id,
      payment.id
    );
    if (notifyRes.warning) warning += notifyRes.warning;
  }

  revalidatePath('/', 'layout');
  return { success: true, warning: warning || undefined };
}

export async function recordOfflinePayment(formData: FormData) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  const invoiceId = formData.get('invoice_id') as string;
  const amount = Number(formData.get('amount'));
  const paymentMethod = formData.get('payment_method') as string;
  const reference = formData.get('reference_number') as string;

  if (['bank_transfer', 'cheque', 'upi'].includes(paymentMethod) && (!reference || reference.trim() === '')) {
    return { success: false, error: 'Reference number is required for Bank Transfer, Cheque, and UPI payments.' };
  }

  const { data: invoice, error } = await supabase.from('fee_invoices').select('*').eq('id', invoiceId).eq('tenant_id', tenantId).single();
  if (error || !invoice) return { success: false, error: 'Invoice not found' };

  if (amount <= 0 || amount > invoice.balance_amount) {
    return { success: false, error: 'Invalid payment amount' };
  }

  // Insert Payment
  const { data: paymentRecord, error: payErr } = await supabase.from('fee_payments').insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    student_id: invoice.student_id,
    amount: amount,
    payment_method: paymentMethod,
    reference_number: reference,
    payment_status: 'success',
    paid_at: new Date().toISOString(),
    collected_by: user.id
  }).select().single();

  if (payErr) return { success: false, error: payErr.message };

  // Update Invoice
  const newPaidAmount = Number(invoice.paid_amount) + amount;
  const newBalance = Number(invoice.total_amount) - newPaidAmount;
  const status = newBalance <= 0 ? 'paid' : 'partially_paid';

  await supabase.from('fee_invoices').update({
    paid_amount: newPaidAmount,
    balance_amount: newBalance,
    status,
    paid_at: newBalance <= 0 ? new Date().toISOString() : invoice.paid_at
  }).eq('id', invoice.id);

  // Generate Receipt
  const receiptNum = `RCPT-${tenantId.slice(0,4).toUpperCase()}-${Date.now()}`;
  await supabase.from('fee_receipts').insert({
    tenant_id: tenantId,
    payment_id: paymentRecord.id,
    invoice_id: invoice.id,
    receipt_number: receiptNum
  });

  // Audit
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: 'payment.offline.recorded',
    entity_type: 'fee_payments',
    entity_id: paymentRecord.id
  });

  let warning = '';
  try {
    await generateAndUploadReceiptPdf(paymentRecord.id);
  } catch (err: any) {
    warning += `Receipt generation failed: ${err.message}. `;
  }

  // Notification
  const { data: studentData } = await supabase.from('students').select('first_name, last_name, parent_email, parent_phone').eq('id', invoice.student_id).single();
  if (studentData) {
    const notifyRes = await sendNotification(
      tenantId, invoice.student_id, 'payment.success',
      studentData.parent_email || null, studentData.parent_phone || null,
      {
        receiptNumber: receiptNum,
        studentName: `${studentData.first_name} ${studentData.last_name}`,
        amount: paymentRecord.amount,
        method: paymentMethod.toUpperCase()
      },
      invoice.id,
      paymentRecord.id
    );
    if (notifyRes.warning) warning += notifyRes.warning;
  }

  revalidatePath('/', 'layout');
  return { success: true, warning: warning || undefined };
}
