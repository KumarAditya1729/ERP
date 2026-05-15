'use server';

import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Fix jsPDF types for Node.js
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDFWithPlugin;
  lastAutoTable?: { finalY: number };
}

export async function generateAndUploadInvoicePdf(invoiceId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'student', 'parent']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();

  // Fetch invoice details
  const { data: invoice, error: invErr } = await supabase
    .from('fee_invoices')
    .select('*, students(*)')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .single();

  if (invErr || !invoice) throw new Error('Invoice not found');

  const { data: items } = await supabase
    .from('fee_invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId);

  const doc = new jsPDF() as jsPDFWithPlugin;
  
  doc.setFontSize(22);
  doc.setTextColor(30, 64, 175);
  doc.text('NexSchool ERP', 105, 20, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('FEE INVOICE', 105, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Invoice Number: ${invoice.invoice_number}`, 14, 45);
  doc.text(`Billing Month: ${invoice.billing_month}`, 14, 50);
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 14, 55);

  doc.text(`Student: ${invoice.students?.first_name} ${invoice.students?.last_name}`, 120, 45);
  doc.text(`Class: ${invoice.students?.class_grade}-${invoice.students?.section}`, 120, 50);

  const tableData = (items || []).map((item: any) => [
    item.description,
    `Rs. ${item.amount}`,
    `Rs. ${item.discount_amount}`,
    `Rs. ${item.final_amount}`
  ]);

  doc.autoTable({
    startY: 65,
    head: [['Description', 'Amount', 'Discount', 'Final Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [46, 20, 140] }
  });

  const finalY = doc.lastAutoTable?.finalY || 100;
  
  doc.text(`Subtotal: Rs. ${invoice.subtotal}`, 140, finalY + 10);
  doc.text(`Discount Total: -Rs. ${invoice.discount_total}`, 140, finalY + 16);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Amount: Rs. ${invoice.total_amount}`, 140, finalY + 24);
  doc.text(`Paid Amount: Rs. ${invoice.paid_amount}`, 140, finalY + 30);
  doc.setTextColor(220, 38, 38);
  doc.text(`Balance Due: Rs. ${invoice.balance_amount}`, 140, finalY + 36);

  const pdfBuffer = doc.output('arraybuffer');
  
  const fileName = `${tenantId}/${invoice.invoice_number}.pdf`;
  
  // Upload to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from('fee-invoices')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadErr) {
    // Return signed URL if it already exists or fail
    if(uploadErr.message.includes('already exists')) {
       // Ignore if upsert didn't work for some reason, we'll just generate the link below
    } else {
       throw new Error(`Upload failed: ${uploadErr.message}`);
    }
  }

  return getInvoicePdfDownloadUrl(invoiceId, fileName);
}

export async function getInvoicePdfDownloadUrl(invoiceId: string, fileName?: string) {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'student', 'parent']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  
  if (!fileName) {
     const { data: invoice } = await supabase.from('fee_invoices').select('invoice_number').eq('id', invoiceId).single();
     if(!invoice) throw new Error('Invoice not found');
     fileName = `${tenantId}/${invoice.invoice_number}.pdf`;
  }

  const { data, error } = await supabase.storage
    .from('fee-invoices')
    .createSignedUrl(fileName!, 3600); // 1 hour expiry

  if (error || !data) throw new Error('Could not generate signed URL');

  return { success: true, url: data.signedUrl };
}

export async function generateAndUploadReceiptPdf(paymentId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'student', 'parent']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();

  // Fetch payment and receipt details
  const { data: payment, error: payErr } = await supabase
    .from('fee_payments')
    .select('*, fee_invoices(*, students(*)), fee_receipts(*)')
    .eq('id', paymentId)
    .eq('tenant_id', tenantId)
    .single();

  if (payErr || !payment || !payment.fee_receipts || payment.fee_receipts.length === 0) {
    throw new Error('Payment or receipt not found');
  }

  const invoice = payment.fee_invoices;
  const student = invoice.students;
  const receipt = payment.fee_receipts[0];

  const doc = new jsPDF() as jsPDFWithPlugin;
  
  doc.setFontSize(22);
  doc.setTextColor(30, 64, 175);
  doc.text('NexSchool ERP', 105, 20, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('PAYMENT RECEIPT', 105, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Receipt Number: ${receipt.receipt_number}`, 14, 45);
  doc.text(`Date of Payment: ${new Date(payment.paid_at).toLocaleDateString()}`, 14, 50);
  doc.text(`Payment Method: ${payment.payment_method.toUpperCase()}`, 14, 55);
  if (payment.reference_number) {
    doc.text(`Reference No: ${payment.reference_number}`, 14, 60);
  }

  doc.text(`Student: ${student.first_name} ${student.last_name}`, 120, 45);
  doc.text(`Class: ${student.class_grade}-${student.section}`, 120, 50);
  doc.text(`Invoice No: ${invoice.invoice_number}`, 120, 55);

  doc.autoTable({
    startY: 70,
    head: [['Description', 'Amount Paid']],
    body: [
      [`Payment towards invoice ${invoice.invoice_number}`, `Rs. ${payment.amount}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] } // Emerald color
  });

  const finalY = doc.lastAutoTable?.finalY || 100;
  
  doc.setFontSize(10);
  doc.text('* Computer generated receipt. No signature required.', 14, finalY + 20);

  const pdfBuffer = doc.output('arraybuffer');
  const fileName = `${tenantId}/${receipt.receipt_number}.pdf`;
  
  // Upload to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from('fee-receipts')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadErr && !uploadErr.message.includes('already exists')) {
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  // Update receipt url in DB
  await supabase.from('fee_receipts').update({ receipt_url: fileName }).eq('id', receipt.id);

  return getReceiptPdfDownloadUrl(receipt.id, fileName);
}

export async function getReceiptPdfDownloadUrl(receiptId: string, fileName?: string) {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'student', 'parent']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  const supabase = createClient();
  
  if (!fileName) {
     const { data: receipt } = await supabase.from('fee_receipts').select('receipt_url, receipt_number').eq('id', receiptId).single();
     if(!receipt) throw new Error('Receipt not found');
     fileName = receipt.receipt_url || `${tenantId}/${receipt.receipt_number}.pdf`;
  }

  const { data, error } = await supabase.storage
    .from('fee-receipts')
    .createSignedUrl(fileName!, 3600); // 1 hour expiry

  if (error || !data) throw new Error('Could not generate signed URL');

  return { success: true, url: data.signedUrl };
}
