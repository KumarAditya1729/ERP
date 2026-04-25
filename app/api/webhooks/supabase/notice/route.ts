import { NextResponse } from 'next/server';
import { dispatchNotification } from '@/lib/notifications';
import { webhookRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request';
import { getOptionalSecret, isProduction } from '@/lib/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// Use Service Role Key to bypass RLS for background workers
export async function POST(req: Request) {
  try {
    const { success } = await webhookRateLimit.limit(`notice:${getClientIp(req.headers)}`);
    if (!success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const webhookSecret = getOptionalSecret('SUPABASE_NOTICE_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-notice-webhook-secret');

    if (webhookSecret) {
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
      }
    } else if (isProduction()) {
      return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 503 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Notification database is not configured' }, { status: 503 });
    }

    const payload = await req.json();

    // Verify it's an INSERT operation from Supabase Webhook
    if (payload.type !== 'INSERT' || payload.table !== 'notices') {
      return NextResponse.json({ message: 'Ignored: Not a Notice Insert' }, { status: 200 });
    }

    const { target_audience, tenant_id, title, message } = payload.record;
    
    // Determine who needs to receive this SMS
    let audienceQuery = supabase.from('students').select('id, first_name, emergency_contact').eq('tenant_id', tenant_id);
    
    // If it's not "All Parents", target the specific class
    if (target_audience !== 'All Parents') {
      const parsedClass = target_audience.replace('Class ', '').trim();
      const match = parsedClass.match(/^(.+?)([A-Za-z])?$/);
      const classGrade = match?.[1]?.trim();
      const section = match?.[2]?.trim();

      if (classGrade) {
        audienceQuery = audienceQuery.eq('class_grade', classGrade);
      }

      if (section) {
        audienceQuery = audienceQuery.eq('section', section);
      }
    }

    const { data: students, error } = await audienceQuery;
    
    if (error || !students) {
      console.error('Webhook Error: Failed to fetch audience', error);
      return NextResponse.json({ error: 'Failed to map audience' }, { status: 500 });
    }

    // Strip duplicate phone numbers (e.g. siblings)
    const uniquePhones = new Set<string>();
    const recipients: {name: string, phone: string}[] = [];
    
    students.forEach(s => {
      // Assuming emergency_contact holds the primary parent phone in E.164 format
      if (s.emergency_contact && !uniquePhones.has(s.emergency_contact)) {
        uniquePhones.add(s.emergency_contact);
        recipients.push({ name: s.first_name, phone: s.emergency_contact });
      }
    });

    // PUSH NOTIFICATIONS INTO REDIS LIST FOR ASYNC WORKER TO HANDLE
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (redisUrl && redisToken) {
       const { Redis } = await import('@upstash/redis');
       const redis = new Redis({ url: redisUrl, token: redisToken });
       
       const pipeline = redis.pipeline();
       recipients.forEach(r => {
         pipeline.lpush('nexschool:sms_queue', JSON.stringify({
            to: r.phone,
            body: `NexSchool Notice: ${title}. Hello ${r.name}, please check your portal.`
         }));
       });
       await pipeline.exec();
       console.log(`[Webhook] Pushed ${recipients.length} messages into Upstash Redis Queue.`);
    } else {
       console.warn("[Webhook] UPSTASH REDIS MISSING. Firing synchronously fallback.");
       const dispatchPromises = recipients.map(r => 
         dispatchNotification({
           channel: 'SMS',
           to: r.phone,
           body: `NexSchool Notice: ${title}. Hello ${r.name}, please check your parent portal.`
         })
       );
       await Promise.allSettled(dispatchPromises);
    }
    
    return NextResponse.json({ success: true, dispatched: recipients.length }, { status: 200 });
  } catch (err: any) {
    console.error('Notice Webhook Processing Failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
