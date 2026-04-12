import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(req: Request) {
  const body = await req.text()

  const event = stripe.webhooks.constructEvent(
    body,
    req.headers.get('stripe-signature')!,
    process.env.STRIPE_WEBHOOK_SECRET!
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any

    const tenantId = session.metadata.tenant_id

    // ✅ Activate subscription
    await supabase
      .from('tenants')
      .update({
        subscription_status: 'active',
      })
      .eq('id', tenantId)
  }

  return NextResponse.json({ received: true })
}
