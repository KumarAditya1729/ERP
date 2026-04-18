import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const tenantId = session.metadata?.tenant_id

      if (!tenantId) {
        console.error('Webhook: Missing tenant_id in session metadata')
        return NextResponse.json({ error: 'Missing tenant metadata' }, { status: 400 })
      }

      // ✅ Activate subscription using admin client (bypasses RLS securely)
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)

      if (error) {
        console.error('Webhook: Failed to update tenant subscription:', error)
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
      }

      console.log(`Webhook: Activated subscription for tenant ${tenantId}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }
}
