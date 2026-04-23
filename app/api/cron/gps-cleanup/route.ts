import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Delete pings older than 30 days (keep gps_vehicle_latest forever)
  await supabase
    .from('gps_pings')
    .delete()
    .lt('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    
  return NextResponse.json({ ok: true })
}
