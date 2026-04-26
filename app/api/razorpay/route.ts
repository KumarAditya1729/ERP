import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth-guard';
import { apiRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const PLAN_AMOUNTS = {
  starter: 2999,
  growth: 7999,
} as const;

const CUSTOM_DETAILS_SCHEMA = z.object({
  estimated_students: z.number().int().positive().max(100000).optional(),
  branch_count: z.number().int().positive().max(100).optional(),
  billing_email: z.string().email().optional(),
  contact_phone: z.string().regex(/^\+?[0-9\s-]{10,}$/).optional(),
  custom_requirements: z.string().max(2000).optional(),
  custom_monthly_amount: z.number().int().positive().max(10000000).optional(),
}).optional();

const ORDER_SCHEMA = z.object({
  amount: z.number().positive().max(10000000),
  plan: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  customDetails: CUSTOM_DETAILS_SCHEMA,
}).superRefine((data, ctx) => {
  if (data.plan === 'starter' && data.amount !== PLAN_AMOUNTS.starter) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Starter plan amount is invalid' });
  }

  if (data.plan === 'growth' && data.amount !== PLAN_AMOUNTS.growth) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Growth plan amount is invalid' });
  }

  if (data.plan === 'enterprise') {
    if (!data.customDetails?.billing_email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customDetails', 'billing_email'], message: 'Billing email is required' });
    }

    if (!data.customDetails?.estimated_students) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customDetails', 'estimated_students'], message: 'Estimated students is required' });
    }

    if (!data.customDetails?.branch_count) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customDetails', 'branch_count'], message: 'Branch count is required' });
    }

    if (!data.customDetails?.custom_monthly_amount || data.customDetails.custom_monthly_amount !== data.amount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customDetails', 'custom_monthly_amount'], message: 'Custom monthly amount must match the payable amount' });
    }
  }
});

const VERIFY_SCHEMA = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  plan: z.enum(['starter', 'growth', 'enterprise']),
});

// Fail loudly at request-time if keys are missing
function getRazorpayClient() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.startsWith('YOUR_') || keySecret.startsWith('YOUR_')) {
    throw new Error('Razorpay keys not configured. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// POST /api/razorpay — Create an order
export async function POST(req: Request) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin']);
  if (authErr) return authErr;

  try {
    const { success } = await apiRateLimit.limit(`billing:create:${tenantId ?? 'unknown'}:${user.id}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many billing requests. Please try again in a minute.' }, { status: 429 });
    }

    const razorpay = getRazorpayClient();
    const parsedBody = ORDER_SCHEMA.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid order payload' }, { status: 400 });
    }

    const { amount, plan, customDetails } = parsedBody.data;
    const supabase = getSupabaseAdminClient();

    if (tenantId && supabase && plan === 'enterprise' && customDetails) {
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          max_students: customDetails.estimated_students ?? null,
          branch_count: customDetails.branch_count ?? null,
          billing_email: customDetails.billing_email ?? null,
          contact_phone: customDetails.contact_phone ?? null,
          custom_requirements: customDetails.custom_requirements ?? null,
          custom_monthly_amount: customDetails.custom_monthly_amount ?? null,
        })
        .eq('id', tenantId);

      if (updateError) {
        console.error('Failed to save enterprise plan details:', updateError.message);
      }
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay uses paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        plan,
        tenant_id: tenantId ?? '',
        billing_email: customDetails?.billing_email?.slice(0, 255) ?? '',
        student_count: customDetails?.estimated_students ? String(customDetails.estimated_students) : '',
        branch_count: customDetails?.branch_count ? String(customDetails.branch_count) : '',
        contact_phone: customDetails?.contact_phone?.slice(0, 50) ?? '',
        custom_amount: customDetails?.custom_monthly_amount ? String(customDetails.custom_monthly_amount) : '',
        requirements: customDetails?.custom_requirements?.slice(0, 255) ?? '',
      },
    });

    return NextResponse.json({ order }, { status: 200 });

  } catch (error: any) {
    console.error('Razorpay Create Order Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/razorpay — Verify payment signature + activate subscription
export async function PUT(req: Request) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin']);
  if (authErr) return authErr;

  try {
    const { success } = await apiRateLimit.limit(`billing:verify:${tenantId ?? 'unknown'}:${user.id}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many payment verification attempts. Please try again shortly.' }, { status: 429 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.startsWith('YOUR_')) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const parsedBody = VERIFY_SCHEMA.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Missing payment verification parameters' }, { status: 400 });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = parsedBody.data;

    // 1. Cryptographic signature check (HMAC-SHA256)
    const generated_signature = crypto
      .createHmac('sha256', keySecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (
      generated_signature.length !== razorpay_signature.length ||
      !crypto.timingSafeEqual(Buffer.from(generated_signature), Buffer.from(razorpay_signature))
    ) {
      console.error('Razorpay signature mismatch');
      return NextResponse.json({ error: 'Payment signature invalid — possible fraud attempt.' }, { status: 400 });
    }

    // 2. Activate subscription in DB (admin client to bypass RLS)
    if (tenantId) {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        return NextResponse.json({ error: 'Billing database is not configured' }, { status: 503 });
      }
      
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
        .eq('id', tenantId);

      if (dbError) {
        console.error('Failed to activate subscription:', dbError.message);
        // Don't fail — payment is verified. Log for manual fix.
      } else {
        console.log(`[Billing] Tenant ${tenantId} activated on ${plan} plan until ${paidUntil.toISOString()}`);
      }
    }

    return NextResponse.json({ message: 'Payment verified and subscription activated!' }, { status: 200 });

  } catch (error: any) {
    console.error('Razorpay Verify Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
