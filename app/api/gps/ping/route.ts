import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { webhookRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'
import { getClientIp } from '@/lib/request'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const { success } = await webhookRateLimit.limit(`gps:${ip}`)
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 })

  const signature = req.headers.get('x-device-signature')
  const deviceId = req.headers.get('x-device-id')
  if (!signature || !deviceId) {
    return NextResponse.json({ error: 'Missing auth headers' }, { status: 401 })
  }

  const body = await req.text()
  const gpsSecret = process.env.GPS_DEVICE_SECRET
  if (!gpsSecret) {
    return NextResponse.json({ error: 'GPS secret is not configured' }, { status: 503 })
  }

  const expectedSig = crypto
    .createHmac('sha256', gpsSecret)
    .update(body)
    .digest('hex')

  if (
    signature.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: {
    device_id: string
    lat: number
    lng: number
    speed?: number
    heading?: number
    accuracy?: number
    battery?: number
    ignition?: boolean
    timestamp?: string
  }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.device_id !== deviceId) {
    return NextResponse.json({ error: 'Device ID mismatch' }, { status: 401 })
  }

  if (
    typeof payload.lat !== 'number' || typeof payload.lng !== 'number' ||
    payload.lat < -90 || payload.lat > 90 ||
    payload.lng < -180 || payload.lng > 180
  ) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 422 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: vehicle, error: vErr } = await supabase
    .from('gps_vehicles')
    .select('id, tenant_id, status')
    .eq('device_id', payload.device_id)
    .single()

  if (vErr || !vehicle) {
    return NextResponse.json({ error: 'Unknown device' }, { status: 404 })
  }
  if (vehicle.status === 'maintenance') {
    return NextResponse.json({ error: 'Vehicle in maintenance' }, { status: 409 })
  }

  const { error: pingErr } = await supabase.from('gps_pings').insert({
    vehicle_id: vehicle.id,
    tenant_id: vehicle.tenant_id,
    latitude: payload.lat,
    longitude: payload.lng,
    speed_kmh: payload.speed ?? 0,
    heading: payload.heading ?? 0,
    accuracy_meters: payload.accuracy,
    battery_percent: payload.battery,
    ignition_on: payload.ignition ?? true,
    recorded_at: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
  })

  if (pingErr) {
    console.error('[GPS] Ping insert error:', pingErr)
    return NextResponse.json({ error: 'DB write failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
