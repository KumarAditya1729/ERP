import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';
import crypto from 'crypto';

const gpsPayloadSchema = z.object({
  deviceId: z.string(),
  timestamp: z.string().datetime(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmph: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional(),
  battery: z.number().min(0).max(100).optional(),
  ignition: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-device-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing x-device-signature header' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const parsed = gpsPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload format', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    // Fetch the device config
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('transport_gps_devices')
      .select('id, tenant_id, vehicle_id, device_secret_hash, is_active')
      .eq('device_imei', data.deviceId)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found or unauthorized' }, { status: 401 });
    }

    if (!device.is_active) {
      return NextResponse.json({ error: 'Device is inactive' }, { status: 403 });
    }

    if (!device.vehicle_id) {
      return NextResponse.json({ error: 'Device not assigned to any vehicle' }, { status: 400 });
    }

    // Validate HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', device.device_secret_hash)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // Insert Event
    const { error: eventError } = await supabaseAdmin.from('transport_gps_events').insert({
      tenant_id: device.tenant_id,
      device_id: device.id,
      vehicle_id: device.vehicle_id,
      latitude: data.lat,
      longitude: data.lng,
      speed_kmh: data.speedKmph || 0,
      heading: data.heading || 0,
      battery_level: data.battery,
      ignition_status: data.ignition,
      recorded_at: data.timestamp
    });

    if (eventError) {
      console.error('GPS Event Insert Error:', eventError);
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
    }

    // Update Latest Vehicle Location
    const { error: updateError } = await supabaseAdmin.from('transport_vehicles').update({
      last_latitude: data.lat,
      last_longitude: data.lng,
      last_speed: data.speedKmph || 0,
      last_heading: data.heading || 0,
      last_battery: data.battery,
      last_ping_at: data.timestamp
    }).eq('id', device.vehicle_id);

    if (updateError) {
      console.error('Vehicle Update Error:', updateError);
    }

    // (Alert generation logic could be added here - e.g., overspeed checks)
    if (data.speedKmph && data.speedKmph > 80) {
      await supabaseAdmin.from('transport_alerts').insert({
        tenant_id: device.tenant_id,
        vehicle_id: device.vehicle_id,
        alert_type: 'overspeed',
        message: `Vehicle exceeded speed limit: ${data.speedKmph} km/h`
      });
      // Optionally notify parents/admin via notifications.ts
    }

    return NextResponse.json({ success: true, message: 'Ingested successfully' });
  } catch (error: any) {
    console.error('GPS Ingest Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
