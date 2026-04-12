import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const { data: tenants } = await supabase.from('tenants').select('*')

  for (const tenant of tenants || []) {
    if (tenant.subscription_status !== 'active') {
      // deactivate access
    }
  }

  return NextResponse.json({ status: 'done' })
}
