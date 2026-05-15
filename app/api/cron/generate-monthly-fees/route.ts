import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not configured.' }, { status: 500 });
  }

  const isValidAuth = authHeader === `Bearer ${secret}` || cronHeader === secret;
  if (!isValidAuth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Admin client to bypass RLS for background job
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  await supabase.from('audit_logs').insert({
    action: 'cron.monthly_fees.started',
    entity_type: 'cron',
    metadata: { timestamp: new Date().toISOString() }
  });

  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}`;
  const billingMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];

  let processedTenants = 0;
  let processedStudents = 0;
  let invoicesGenerated = 0;
  let invoicesSkipped = 0;
  const errors: any[] = [];

  try {
    // 1. Get all active tenants
    const { data: tenants, error: tenantErr } = await supabase.from('tenants').select('id');
    if (tenantErr) throw tenantErr;

    for (const tenant of tenants) {
      processedTenants++;

      // 2. Get active fee assignments for this tenant
      const { data: assignments, error: assgnErr } = await supabase
        .from('student_fee_assignments')
        .select('*, fee_structures(*, fee_categories(*))')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      if (assgnErr || !assignments || assignments.length === 0) continue;

      // Group assignments by student
      const studentAssignments = assignments.reduce((acc: any, curr: any) => {
        if (!acc[curr.student_id]) acc[curr.student_id] = [];
        acc[curr.student_id].push(curr);
        return acc;
      }, {});

      for (const studentId of Object.keys(studentAssignments)) {
        processedStudents++;
        const studentAssgns = studentAssignments[studentId];

        try {
          // Prevent duplicates: Check if invoice already exists for this student and billing month
          const { data: existingInvoice } = await supabase
            .from('fee_invoices')
            .select('id')
            .eq('student_id', studentId)
            .eq('billing_month', billingMonth)
            .eq('tenant_id', tenant.id)
            .limit(1);

          if (existingInvoice && existingInvoice.length > 0) {
            invoicesSkipped++;
            continue;
          }

          const invoiceNumber = `INV-${tenant.id.slice(0, 4).toUpperCase()}-${currentMonthStr}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
          
          let subtotal = 0;
          let discount_total = 0;

          const invoiceItems = studentAssgns.map((a: any) => {
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
          const dueDay = 10;
          const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay).toISOString().split('T')[0];

          // Insert Invoice
          const { data: invoiceData, error: invErr } = await supabase.from('fee_invoices').insert({
            tenant_id: tenant.id,
            student_id: studentId,
            invoice_number: invoiceNumber,
            academic_year: '2025-2026',
            billing_month: billingMonth,
            subtotal,
            discount_total,
            total_amount,
            balance_amount: total_amount,
            due_date: dueDate,
            status: 'issued'
          }).select().single();

          if (invErr) throw invErr;

          // Insert Items
          const itemsToInsert = invoiceItems.map((item: any) => ({
            ...item,
            tenant_id: tenant.id,
            invoice_id: invoiceData.id
          }));

          const { error: itemsErr } = await supabase.from('fee_invoice_items').insert(itemsToInsert);
          if (itemsErr) throw itemsErr;

          invoicesGenerated++;
        } catch (err: any) {
          errors.push({ tenantId: tenant.id, studentId, reason: err.message });
        }
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'cron.monthly_fees.completed',
      entity_type: 'cron',
      metadata: { processedTenants, processedStudents, invoicesGenerated, invoicesSkipped, errorsCount: errors.length }
    });

    return NextResponse.json({
      success: true,
      processedTenants,
      processedStudents,
      invoicesGenerated,
      invoicesSkipped,
      errors
    });
  } catch (err: any) {
    await supabase.from('audit_logs').insert({
      action: 'cron.monthly_fees.failed',
      entity_type: 'cron',
      metadata: { error: err.message }
    });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
