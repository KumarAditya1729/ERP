import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const students = body.students;

    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: 'Payload must contain a students array' }, { status: 400 });
    }

    // In a real multi-tenant scenario, we determine tenant_id from the session token.
    // Since we are bypassing RLS with service_role to insert bulk rows fast, we need a hardcoded/resolved tenant_id.
    // We will fetch the first tenant admin for MVP.
    const { data: adminProfile } = await supabase.from('profiles').select('tenant_id').eq('role', 'admin').limit(1).single();
    
    if (!adminProfile) {
       return NextResponse.json({ error: 'System is missing an active tenant' }, { status: 500 });
    }

    const payload = students.map((s: any) => ({
      tenant_id: adminProfile.tenant_id,
      first_name: s.first_name,
      last_name: s.last_name || '',
      class_grade: s.class_grade || '1',
      section: s.section || 'A',
      guardian_name: s.guardian_name || 'Guardian',
      guardian_phone: s.emergency_contact || '0000000000',
      status: 'active',
      roll_number: Math.floor(Math.random() * 100).toString().padStart(2, '0') // Auto-assign roll
    }));

    // BATCH INSERT - Supabase handles arrays nicely in a single transaction
    const { error } = await supabase.from('students').insert(payload);

    if (error) {
       console.error("Bulk Import Failed:", error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: payload.length }, { status: 200 });
  } catch (err: any) {
    console.error('Bulk Import API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
