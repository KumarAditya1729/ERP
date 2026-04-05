import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { dispatchNotification } from '@/lib/notifications';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Allow this route to run up to 5 minutes to consume queue
export const maxDuration = 300;

/** Sends a critical alert to Slack/Discord via ALERT_WEBHOOK_URL env var */
async function sendAlert(message: string) {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 *NexSchool AI Alert*: ${message}` }),
    });
  } catch (e) {
    console.warn('[Alert] Failed to send webhook alert:', e);
  }
} 

export async function GET(request: Request) {
  // Secure cron route (Vercel sets explicit header on CRON calls)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
     console.warn("Unauthorized attempt to trigger SMS worker");
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ error: 'Redis unconfigured' }, { status: 500 });
  }

  try {
    let processed = 0;
    const batchSize = 100; // Process 100 texts max per minute run

    for (let i = 0; i < batchSize; i++) {
       // RPOP -> Pop the oldest message out of the Redis List
       const payloadStr = await redis.rpop('nexschool:sms_queue');
       if (!payloadStr) break; // Queue empty

       const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
       
       try {
         await dispatchNotification({
           channel: 'SMS',
           to: payload.to,
           body: payload.body
         });
         processed++;
       } catch (dispatchError: any) {
         console.error(`[Worker DLQ Alert] SMS failed for ${payload.to}. Routing to Dead Letter Queue.`);
         // Route to DLQ for manual inspection or retry
         await redis.lpush('nexschool:sms_dlq', JSON.stringify({
            original_payload: payload,
            error: dispatchError.message,
            timestamp: new Date().toISOString()
         }));
         // Ping Slack/Discord so team knows immediately
         await sendAlert(`SMS dispatch failed for ${payload.to}. Moved to DLQ. Error: ${dispatchError.message}`);
       }
    }

    console.log(`[Queue Worker] Processed ${processed} SMS messages via Redis.`);
    return NextResponse.json({ status: 'success', processed }, { status: 200 });
  } catch (error: any) {
    console.error('[SMS Worker Failed]', error);
    await sendAlert(`SMS Worker CRASHED. System may be degraded. Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
