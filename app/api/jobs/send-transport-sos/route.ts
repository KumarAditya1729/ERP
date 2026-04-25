import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs';
import { sendSMS } from '@/lib/services/twilio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    const payload = await req.json();
    const { message, tenantId } = payload;

    if (!message || !tenantId) {
      return NextResponse.json({ error: 'Missing payload requirements' }, { status: 400 });
    }

    // 1. Fetch all parents linked to this tenant
    // In a real app, you might filter by those who have kids enrolled in transport.
    // For now, we query parents directly or students with guardians.
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('guardian_phone')
      .eq('tenant_id', tenantId)
      .not('guardian_phone', 'is', null);

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, delivered: 0, msg: "No guardian numbers found" });
    }

    // De-duplicate phone numbers
    const uniquePhones = Array.from(new Set(students.map(s => s.guardian_phone)));

    // 2. Execute parallel SMS dispatch via Twilio
    const smsPromises = uniquePhones
      .filter(phone => phone && phone.length >= 10)
      .map(async (guardian_phone) => {
        const to = guardian_phone.startsWith('+') ? guardian_phone : `+91${guardian_phone.replace(/[- ]/g, '')}`;
        
        try {
          await sendSMS({ to, message: `🚨 TRANSPORT SOS: ${message}` });
          return { phone: to, status: 'sent' };
        } catch (err) {
          console.error(`[SOS WORKER] SMS Failed for ${to}:`, err);
          return { phone: to, status: 'failed' };
        }
      });

    const dispatchedLogs = await Promise.all(smsPromises);

    // 3. Log the successful batch processing
    return NextResponse.json({ success: true, delivered: dispatchedLogs.length, logs: dispatchedLogs });

  } catch (error: any) {
    console.error('[SOS WORKER] Fatal Error:', error);
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
