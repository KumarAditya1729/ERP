import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { apiRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

// Zod schema for student validation
const StudentSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  class_grade: z.string().min(1, 'Class grade is required'),
  section: z.string().optional(),
  guardian_name: z.string().optional(),
  emergency_contact: z.string().optional(),
});

const BulkImportSchema = z.object({
  students: z.array(StudentSchema).min(1, 'At least one student is required'),
});

export async function POST(req: Request) {
  const { user, role, tenantId, error: authErr } = await requireAuth(['admin', 'teacher']);
  if (authErr) return authErr;

  try {
    const { success } = await apiRateLimit.limit(`bulk-import:${tenantId ?? 'unknown'}:${user.id}`);
    if (!success) {
      return NextResponse.json({ error: 'Bulk import rate limit exceeded. Please try again shortly.' }, { status: 429 });
    }

    // ── Request Validation ───────────────────────────────────────────────────────────
    const body = await req.json();
    const validationResult = BulkImportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const { students } = validationResult.data;

    // ── Tenant Resolution ───────────────────────────────────────────────────────────
    if (!tenantId) {
      return NextResponse.json({ error: 'User tenant not found' }, { status: 400 });
    }

    // Verify tenant exists and is active
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, subscription_status, subscription_tier')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 });
    }

    if (tenant.subscription_status !== 'active') {
      return NextResponse.json({ error: 'Tenant subscription is not active' }, { status: 403 });
    }

    // ── Check Student Limit (Plan Enforcement) ───────────────────────────────────────
    const { data: existingStudents, error: countError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId);

    if (countError) {
      console.error('Failed to count existing students:', countError);
      return NextResponse.json({ error: 'Failed to validate student limit' }, { status: 500 });
    }

    const currentCount = existingStudents?.length || 0;
    const newTotal = currentCount + students.length;

    // Basic plan limits (can be enhanced with plan-specific logic)
    const STUDENT_LIMITS = {
      starter: 300,
      growth: 1500,
      enterprise: 5000,
    };

    const planLimit = STUDENT_LIMITS[tenant.subscription_tier as keyof typeof STUDENT_LIMITS] ?? STUDENT_LIMITS.starter;

    if (newTotal > planLimit) {
      return NextResponse.json({ 
        error: `Student limit exceeded. Current: ${currentCount}, Adding: ${students.length}, Limit: ${planLimit}` 
      }, { status: 403 });
    }

    // ── Prepare Payload for Insertion ─────────────────────────────────────────────────
    const payload = students.map((s, index) => ({
      tenant_id: tenantId,
      first_name: s.first_name.trim(),
      last_name: s.last_name?.trim() || '',
      class_grade: s.class_grade.trim(),
      section: s.section?.trim() || 'A',
      guardian_name: s.guardian_name?.trim() || 'Guardian',
      guardian_phone: s.emergency_contact?.trim() || '0000000000',
      status: 'active',
      roll_number: `${new Date().getFullYear()}${(currentCount + index + 1).toString().padStart(3, '0')}`,
      created_by: user.id,
      created_at: new Date().toISOString(),
    }));

    // ── Batch Insert with Error Handling ─────────────────────────────────────────────
    const { error } = await supabaseAdmin.from('students').insert(payload);

    if (error) {
      console.error("Bulk Import Failed:", error);
      return NextResponse.json({ error: 'Failed to insert students' }, { status: 500 });
    }

    console.log(`Bulk Import: Successfully inserted ${payload.length} students for tenant ${tenantId} by ${role}`);

    return NextResponse.json({ 
      success: true, 
      inserted: payload.length,
      total_students: newTotal,
      remaining_limit: planLimit - newTotal
    }, { status: 200 });

  } catch (err: any) {
    console.error('Bulk Import API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
