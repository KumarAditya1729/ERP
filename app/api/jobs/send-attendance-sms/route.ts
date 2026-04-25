import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs';
import { sendSMS } from '@/lib/services/twilio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// We verify the request cryptographically to ensure it actually came from QStash
async function handler(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

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

    // 2. Execute parallel SMS dispatch via Twilio (wrapped in QStash to avoid client-side timeouts)
    const smsPromises = students
      .filter(s => s.guardian_phone && s.guardian_phone.length >= 10)
      .map(async (student) => {
        const message = `NexSchool Alert: ${student.first_name} was marked absent today (${dateStr}). Contact the school office for more info.`;
        const to = student.guardian_phone.startsWith('+') ? student.guardian_phone : `+91${student.guardian_phone.replace(/[- ]/g, '')}`;
        
        try {
          await sendSMS({ to, message });
          return { phone: to, student: student.id, status: 'sent' };
        } catch (err) {
          console.error(`[QSTASH WORKER] SMS Failed for ${student.id}:`, err);
          return { phone: to, student: student.id, status: 'failed' };
        }
      });

    const dispatchedLogs = await Promise.all(smsPromises);

    // 3. Log the successful batch processing
    return NextResponse.json({ success: true, delivered: dispatchedLogs.length, logs: dispatchedLogs });

  } catch (error: any) {
    console.error('[QSTASH WORKER] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Wrap the export in QStash's verifier conditionally so Vercel builds don't crash without ENV variables
export const POST = process.env.QSTASH_CURRENT_SIGNING_KEY
  ? verifySignatureAppRouter(handler, {
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || process.env.QSTASH_CURRENT_SIGNING_KEY,
    })
  : handler;
