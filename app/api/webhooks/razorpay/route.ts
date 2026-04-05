import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

/**
 * 1M-USER SCALE: Asynchronous Webhook Ledger
 * 
 * Synchronous client-side payment verification can fail if the user closes the tab
 * before redirecting. Webhooks guarantee we catch server-to-server transaction status.
 */
export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!secret || secret.startsWith('YOUR_')) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    if (!signature) throw new Error("Missing Signature");

    // Cryptographic validation of webhook payload
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(bodyText)
      .digest('hex');

    if (generated_signature !== signature) {
      console.warn("Webhook Signature Mismatch! Possible Replay Attack.");
      return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);
    const event = payload.event;
    
    // Server-side Supabase client using Service Role to bypass RLS for background ledger writes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload.payment.entity;
      const idempotencyKey = `idempotency:razorpay:${paymentEntity.id}`;
      
      // 1. "Golden" Idempotency Check (Redis SETNX lock)
      // This guarantees if Razorpay sends 5 webhooks simultaneously for the exact same physical payment,
      // only the first API invocation gets the lock. The rest return instantly.
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (redisUrl && redisToken) {
         const { Redis } = await import('@upstash/redis');
         const redis = new Redis({ url: redisUrl, token: redisToken });
         const lock = await redis.setnx(idempotencyKey, "locked");
         
         if (lock === 0) {
            console.warn(`[Idempotency] Double-webhook suppressed for ${paymentEntity.id}`);
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
         }
         // Expire lock after 24 hrs so data doesn't pool forever
         await redis.expire(idempotencyKey, 86400); 
      }

      // 2. Perform Ledger Write — mark the fee as paid in our DB
      const orderId = paymentEntity.order_id;
      const { error: dbError } = await supabase
        .from('fees')
        .update({ 
          status: 'paid', 
          payment_method: paymentEntity.method || 'Razorpay',
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', orderId);
      
      if (dbError) {
        console.error(`[Webhook] Failed to update fee ledger for order ${orderId}:`, dbError.message);
        Sentry.captureException(dbError);
      } else {
        console.log(`[Webhook] ✅ Fee marked paid for order ${orderId} — ₹${paymentEntity.amount / 100}`);
      }
      
      return NextResponse.json({ status: 'ok', msg: 'Ledger updated securely.' }, { status: 200 });
    }

    if (event === 'payment.failed') {
       Sentry.captureMessage(`Razorpay Payment Failed: ${payload.payload.payment.entity.id}`, "warning");
       return NextResponse.json({ status: 'ok', msg: 'Failure logged internally.' }, { status: 200 });
    }

    // Acknowledge other events without action
    return NextResponse.json({ status: 'ok' }, { status: 200 });

  } catch (error: any) {
    Sentry.captureException(error);
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
