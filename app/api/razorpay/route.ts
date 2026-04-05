import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Fail loudly at request-time if keys are missing
function getRazorpayClient() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.startsWith('YOUR_') || keySecret.startsWith('YOUR_')) {
    throw new Error('Razorpay keys not configured. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const getAdminDb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/razorpay — Create an order
export async function POST(req: Request) {
  try {
    const razorpay = getRazorpayClient();
    const body = await req.json();
    const { amount, plan } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay uses paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { plan: plan || 'starter' },
    });

    return NextResponse.json({ order }, { status: 200 });

  } catch (error: any) {
    console.error('Razorpay Create Order Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/razorpay — Verify payment signature + activate subscription
export async function PUT(req: Request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.startsWith('YOUR_')) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      tenant_id,
      plan,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification parameters' }, { status: 400 });
    }

    // 1. Cryptographic signature check (HMAC-SHA256)
    const generated_signature = crypto
      .createHmac('sha256', keySecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.error('Razorpay signature mismatch');
      return NextResponse.json({ error: 'Payment signature invalid — possible fraud attempt.' }, { status: 400 });
    }

    // 2. Activate subscription in DB (admin client to bypass RLS)
    if (tenant_id && plan) {
      const supabase = getAdminDb();
      
      // Calculate paid_until = 30 days from now
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30);

      const { error: dbError } = await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_tier: plan,
          paid_until: paidUntil.toISOString(),
          razorpay_subscription_id: razorpay_payment_id,
        })
        .eq('id', tenant_id);

      if (dbError) {
        console.error('Failed to activate subscription:', dbError.message);
        // Don't fail — payment is verified. Log for manual fix.
      } else {
        console.log(`[Billing] ✅ Tenant ${tenant_id} activated on ${plan} plan until ${paidUntil.toISOString()}`);
      }
    }

    return NextResponse.json({ message: 'Payment verified and subscription activated!' }, { status: 200 });

  } catch (error: any) {
    console.error('Razorpay Verify Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
