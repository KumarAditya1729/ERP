import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // ── Bearer Token Authentication ─────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    if (token !== process.env.CRON_SECRET) {
      console.error('Cron: Invalid bearer token provided')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // ── Deactivate Inactive Subscriptions ───────────────────────────────────────────
    const { data: tenants, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, subscription_status, updated_at')
      .in('subscription_status', ['trial', 'past_due', 'canceled'])

    if (fetchError) {
      console.error('Cron: Failed to fetch tenants:', fetchError)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    const deactivatedTenants = []
    
    for (const tenant of tenants || []) {
      // Resolve actual auth user IDs for the tenant before mutating auth metadata.
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenant.id)

      if (profileError) {
        console.error(`Cron: Failed to fetch profiles for tenant ${tenant.id}:`, profileError)
        continue
      }

      let usersUpdated = 0
      for (const profile of profiles || []) {
        const { error: userError } = await supabaseAdmin.auth.admin.updateUserById(
          profile.id,
          { user_metadata: { active: false } }
        )

        if (userError) {
          console.error(`Cron: Failed to deactivate user ${profile.id} for tenant ${tenant.id}:`, userError)
          continue
        }

        usersUpdated += 1
      }

      // Update tenant status
      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update({ 
          subscription_status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', tenant.id)

      if (tenantError) {
        console.error(`Cron: Failed to update tenant ${tenant.id}:`, tenantError)
        continue
      }

      deactivatedTenants.push(tenant.id)
      console.log(`Cron: Deactivated tenant ${tenant.name} (${tenant.id}), users updated: ${usersUpdated}`)
    }

    return NextResponse.json({ 
      status: 'done',
      deactivated_count: deactivatedTenants.length,
      deactivated_tenants: deactivatedTenants
    })
  } catch (error) {
    console.error('Cron: Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
