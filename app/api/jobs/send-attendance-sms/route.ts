import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// We verify the request cryptographically to ensure it actually came from QStash
async function handler(req: Request) {
  try {
    const payload = await req.json();
    const { absentIds, dateStr, tenantId } = payload;

    if (!absentIds || !dateStr || !tenantId) {
      return NextResponse.json({ error: 'Missing payload requirements' }, { status: 400 });
    }

    // 1. Fetch parent phone numbers for these specific students
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, first_name, guardian_phone, guardian_name')
      .in('id', absentIds);

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, delivered: 0 });
    }

    // 2. Here we would batch-execute SMS via Twilio/SNS or similar provider. 
    // Because it's running via QStash, Vercel gives this process plenty of time
    // and if it fails, QStash automatically retries it with exponential backoff!
    const dispatchedLogs = [];

    for (const student of students) {
      if (student.guardian_phone) {
        // [TWILIO API CALL HERE]
        const message = `NexSchool Alert: ${student.first_name} was marked absent today (${dateStr}). Contact admin for details.`;
        
        console.log(`[QSTASH WORKER] Simulating SMS to ${student.guardian_phone}: ${message}`);
        dispatchedLogs.push({ phone: student.guardian_phone, student: student.id, status: 'sent' });
      }
    }

    // 3. Log the successful batch processing
    return NextResponse.json({ success: true, delivered: dispatchedLogs.length, logs: dispatchedLogs });

  } catch (error: any) {
    console.error('[QSTASH WORKER] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Wrap the export in QStash's verifier
export const POST = verifySignatureAppRouter(handler);
