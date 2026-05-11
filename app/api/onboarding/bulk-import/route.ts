import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Zod schema for student validation
const StudentSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  class_grade: z.string().min(1, 'Class grade is required'),
  section: z.string().optional(),
  guardian_name: z.string().optional(),
  emergency_contact: z.string().optional(),
  admission_number: z.string().optional(),
  roll_number: z.string().optional(),
});

const BulkImportSchema = z.object({
  students: z.array(StudentSchema).min(1, 'At least one student is required'),
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // ── Session Authentication ───────────────────────────────────────────────────────
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.headers.get(`cookie`)?.match(`${name}=[^;]+`)?.[0]?.split('=')[1];
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Role Authorization ───────────────────────────────────────────────────────────
    const userRole = user.app_metadata?.role;
    if (!['admin', 'teacher'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
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
    const userTenantId = user.app_metadata?.tenant_id;
    if (!userTenantId) {
      return NextResponse.json({ error: 'User tenant not found' }, { status: 400 });
    }

    // Verify tenant exists and is active
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, status, max_students')
      .eq('id', userTenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 });
    }

    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      return NextResponse.json({ error: 'Tenant subscription is not active' }, { status: 403 });
    }

    // ── Check Student Limit (Plan Enforcement) ───────────────────────────────────────
    const { data: existingStudents, error: countError } = await supabaseAdmin
      .from('students')
      .select('id, roll_number')
      .eq('tenant_id', userTenantId);

    if (countError) {
      console.error('Failed to count existing students:', countError);
      return NextResponse.json({ error: 'Failed to validate student limit' }, { status: 500 });
    }

    const currentCount = existingStudents?.length || 0;
    const newTotal = currentCount + students.length;

    // Use tenant's max_students, default to 1000 if not set
    const planLimit = tenant.max_students || 1000;

    if (newTotal > planLimit) {
      return NextResponse.json({ 
        error: `Student limit exceeded. Current: ${currentCount}, Adding: ${students.length}, Limit: ${planLimit}` 
      }, { status: 403 });
    }

    const existingRolls = new Set(existingStudents?.map(s => s.roll_number).filter(Boolean));

    // ── Prepare Payload and Insert ─────────────────────────────────────────────────
    const results = { inserted: 0, skipped: 0, failed: 0, duplicate: 0 };
    
    // Process sequentially or collect valid rows
    const validPayloads = [];
    
    for (let index = 0; index < students.length; index++) {
      const s = students[index];
      const rollNumber = s.admission_number?.trim() || s.roll_number?.trim() || 
        `${new Date().getFullYear()}${(currentCount + index + 1).toString().padStart(3, '0')}`;
        
      if (existingRolls.has(rollNumber)) {
        results.duplicate++;
        results.skipped++;
        continue;
      }
      
      existingRolls.add(rollNumber); // Prevent duplicates within the same CSV batch

      validPayloads.push({
        tenant_id: userTenantId,
        first_name: s.first_name.trim(),
        last_name: s.last_name?.trim() || '',
        class_grade: s.class_grade.trim(),
        section: s.section?.trim() || 'A',
        guardian_name: s.guardian_name?.trim() || 'Guardian',
        guardian_phone: s.emergency_contact?.trim() || '0000000000',
        status: 'active',
        roll_number: rollNumber,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });
    }

    if (validPayloads.length > 0) {
      // ── Batch Insert with Error Handling ─────────────────────────────────────────────
      // We still handle potential PG 23505 errors if a concurrent insert happened, but we try per-row fallback.
      const { error } = await supabaseAdmin.from('students').insert(validPayloads);

      if (error) {
        if (error.code === '23505') {
          // Fallback to row-by-row if batch fails due to unique constraint
          for (const row of validPayloads) {
            const { error: rowErr } = await supabaseAdmin.from('students').insert(row);
            if (rowErr && rowErr.code === '23505') {
              results.duplicate++;
              results.skipped++;
            } else if (rowErr) {
              results.failed++;
              results.skipped++;
            } else {
              results.inserted++;
            }
          }
        } else {
          console.error("Bulk Import Failed:", error);
          return NextResponse.json({ error: 'Failed to insert students' }, { status: 500 });
        }
      } else {
        results.inserted += validPayloads.length;
      }
    }

    console.log(`Bulk Import: Successfully inserted ${results.inserted} students for tenant ${userTenantId}`);

    return NextResponse.json({ 
      success: true, 
      inserted: results.inserted,
      skipped: results.skipped,
      failed: results.failed,
      duplicate: results.duplicate,
      total_students: currentCount + results.inserted,
      remaining_limit: planLimit - (currentCount + results.inserted)
    }, { status: 200 });

  } catch (err: any) {
    console.error('Bulk Import API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
