import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const { tenantId, error } = await requireAuth(['admin', 'teacher', 'staff'])
  if (error) return error

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )

  const { data, error: dbErr } = await supabase
    .from('gps_vehicle_latest')
    .select(`
      vehicle_id,
      latitude,
      longitude,
      speed_kmh,
      heading,
      ignition_on,
      updated_at,
      gps_vehicles!inner (
        vehicle_number,
        driver_name,
        route_name,
        status
      )
    `)
    .eq('tenant_id', tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ vehicles: data })
}
