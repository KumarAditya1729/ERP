import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs';
import { createClient } from '@supabase/supabase-js';
import { sendSMS } from '@/lib/services/twilio';

// Setup Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: Request) {
  try {
    const payload = await req.json();
    const { studentId, tenantId, gatePassCode, reason } = payload;

    if (!studentId || !tenantId || !gatePassCode) {
      return NextResponse.json({ error: 'Missing payload requirements' }, { status: 400 });
    }

    // Fetch the student's guardian phone
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('first_name, guardian_phone')
      .eq('id', studentId)
      .single();

    if (!student || !student.guardian_phone || student.guardian_phone.length < 10) {
      return NextResponse.json({ success: false, error: 'Valid guardian phone not found' });
    }

    const to = student.guardian_phone.startsWith('+') ? student.guardian_phone : `+91${student.guardian_phone.replace(/[- ]/g, '')}`;
    const message = `NexSchool Gate Pass: ${student.first_name} has been issued pass ${gatePassCode}. Reason: ${reason}. Please use this code to verify at the security gate.`;
    
    await sendSMS({ to, message });

    return NextResponse.json({ success: true, delivered: 1 });
  } catch (error: any) {
    console.error('[GATEPASS WORKER] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Wrap the export in QStash's verifier conditionally
export const POST = process.env.QSTASH_CURRENT_SIGNING_KEY
  ? verifySignatureAppRouter(handler, {
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || process.env.QSTASH_CURRENT_SIGNING_KEY,
    })
  : handler;
