import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification } from '@/lib/notifications';

// Use Service Role Key to bypass RLS for background workers
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
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
      // E.g. target_audience = 'Class 10A'
      // We assume it maps to student.class_name for MVP purposes.
      const parsedClass = target_audience.replace('Class ', ''); // '10A'
      audienceQuery = audienceQuery.eq('class_name', parsedClass);
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
