'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// Removed getAdminClientAndTenant() due to N+1 bottleneck

// ── READ ──────────────────────────────────────────────────────────────────────
export async function getTransportRoutes() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const { data: routes, error } = await supabase
      .from('transport_routes')
      .select('*, transport_stops(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const sorted = routes.map(r => ({
      ...r,
      transport_stops: (r.transport_stops ?? [])
        .sort((a: any, b: any) => a.sequence_order - b.sequence_order),
    }));

    return { success: true, data: sorted };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getParentTransportRoute(): Promise<{ success: boolean; data?: any; error?: string }> {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff', 'parent', 'student']);
  if (authErr || !tenantId || !user) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    // Try to find the student linked to this parent
    const { data: parentLinks } = await supabase
      .from('parent_links')
      .select('student_id')
      .eq('parent_id', user.id)
      .limit(1);

    let routeId: string | null = null;

    if (parentLinks && parentLinks.length > 0) {
      // Check if the student has a route_id assigned
      const { data: student } = await supabase
        .from('students')
        .select('route_id')
        .eq('id', parentLinks[0].student_id)
        .single();
      if (student?.route_id) routeId = student.route_id;
    }

    // Build query — prefer the student's assigned route, else show the first active route in the tenant
    const query = supabase
      .from('transport_routes')
      .select('*, transport_stops(*)')
      .eq('tenant_id', tenantId);

    if (routeId) query.eq('id', routeId);

    const { data: routeData, error: routeError } = await query.limit(1).single();

    if (routeError || !routeData) {
      return { success: false, error: 'Transport route not yet assigned to your child.' };
    }

    // Sort stops by sequence order
    const route = {
      ...routeData,
      transport_stops: (routeData.transport_stops ?? [])
        .sort((a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)),
    };

    return { success: true, data: route };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── CREATE ────────────────────────────────────────────────────────────────────
export async function addTransportRoute(payload: {
  name: string;
  driver_name: string;
  bus_number: string;
  capacity: number;
  enrolled_students: number;
  stops?: { stop_name: string; scheduled_time: string }[];
}) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const { data: route, error } = await supabase
      .from('transport_routes')
      .insert({
        tenant_id: tenantId,
        name: payload.name,
        driver_name: payload.driver_name,
        bus_number: payload.bus_number,
        capacity: payload.capacity,
        enrolled_students: payload.enrolled_students,
        status: 'at-school',
      })
      .select().single();

    if (error) throw error;

    // Insert stops if provided
    if (payload.stops && payload.stops.length > 0) {
      const stopsPayload = payload.stops.map((s, idx) => ({
        route_id: route.id,
        tenant_id: tenantId,
        stop_name: s.stop_name,
        scheduled_time: s.scheduled_time,
        status: idx === 0 ? 'upcoming' : 'upcoming',
        sequence_order: idx + 1,
      }));
      await supabase.from('transport_stops').insert(stopsPayload);
    }

    revalidatePath('/', 'layout');
    return { success: true, data: route };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── UPDATE ROUTE STATUS ───────────────────────────────────────────────────────
export async function updateRouteStatus(routeId: string, status: 'on-route' | 'at-school' | 'delayed') {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('transport_routes')
      .update({ status })
      .eq('id', routeId)
      .eq('tenant_id', tenantId); // Tenant safety guard

    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── UPDATE STOP STATUS ────────────────────────────────────────────────────────
export async function updateStopStatus(stopId: string, status: 'done' | 'current' | 'upcoming') {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('transport_stops')
      .update({ status })
      .eq('id', stopId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── UPDATE ENROLLED STUDENTS ──────────────────────────────────────────────────
export async function updateEnrolledStudents(routeId: string, delta: number) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    // Fetch current count first
    const { data: current } = await supabase
      .from('transport_routes')
      .select('enrolled_students, capacity')
      .eq('id', routeId)
      .eq('tenant_id', tenantId)
      .single();

    if (!current) throw new Error('Route not found');
    const newCount = Math.max(0, Math.min(current.capacity, current.enrolled_students + delta));

    const { error } = await supabase
      .from('transport_routes')
      .update({ enrolled_students: newCount })
      .eq('id', routeId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true, newCount };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function deleteTransportRoute(routeId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    // Stops cascade delete via FK — just delete the route
    const { error } = await supabase
      .from('transport_routes')
      .delete()
      .eq('id', routeId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── SEED ──────────────────────────────────────────────────────────────────────
export async function seedTransportDatabase() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const { count } = await supabase
      .from('transport_routes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (count && count > 0) return { success: true, msg: 'Already seeded' };

    const routes = [
      { tenant_id: tenantId, name: 'Route 1 – North Zone', driver_name: 'Ramesh Kumar', bus_number: 'DL-01-GA-2234', capacity: 45, enrolled_students: 42, status: 'on-route' },
      { tenant_id: tenantId, name: 'Route 2 – South Zone', driver_name: 'Sunil Yadav',  bus_number: 'DL-01-GA-2198', capacity: 40, enrolled_students: 37, status: 'at-school' },
      { tenant_id: tenantId, name: 'Route 3 – East Zone',  driver_name: 'Manoj Singh',  bus_number: 'DL-01-GA-1876', capacity: 50, enrolled_students: 48, status: 'on-route' },
      { tenant_id: tenantId, name: 'Route 4 – West Zone',  driver_name: 'Prem Chand',   bus_number: 'DL-01-GA-3321', capacity: 38, enrolled_students: 29, status: 'delayed' },
    ];

    const { data: insertedRoutes, error } = await supabase
      .from('transport_routes').insert(routes).select();
    if (error) throw error;

    if (insertedRoutes && insertedRoutes.length > 0) {
      const stops = [
        { route_id: insertedRoutes[0].id, tenant_id: tenantId, stop_name: 'School Gate',       scheduled_time: '08:05', status: 'done',     sequence_order: 1 },
        { route_id: insertedRoutes[0].id, tenant_id: tenantId, stop_name: 'Sector 14 Stop',    scheduled_time: '08:22', status: 'done',     sequence_order: 2 },
        { route_id: insertedRoutes[0].id, tenant_id: tenantId, stop_name: 'Rajpur Crossing',   scheduled_time: '08:38', status: 'current',  sequence_order: 3 },
        { route_id: insertedRoutes[0].id, tenant_id: tenantId, stop_name: 'Green Park Colony', scheduled_time: '08:51', status: 'upcoming', sequence_order: 4 },
        { route_id: insertedRoutes[0].id, tenant_id: tenantId, stop_name: 'MG Road Junction',  scheduled_time: '09:04', status: 'upcoming', sequence_order: 5 },

        { route_id: insertedRoutes[1].id, tenant_id: tenantId, stop_name: 'School Gate',     scheduled_time: '07:55', status: 'done',     sequence_order: 1 },
        { route_id: insertedRoutes[1].id, tenant_id: tenantId, stop_name: 'Saket Metro',     scheduled_time: '08:10', status: 'done',     sequence_order: 2 },
        { route_id: insertedRoutes[1].id, tenant_id: tenantId, stop_name: 'Malviya Nagar',   scheduled_time: '08:25', status: 'done',     sequence_order: 3 },
        { route_id: insertedRoutes[1].id, tenant_id: tenantId, stop_name: 'Hauz Khas',       scheduled_time: '08:40', status: 'upcoming', sequence_order: 4 },

        { route_id: insertedRoutes[3].id, tenant_id: tenantId, stop_name: 'School Gate',   scheduled_time: '08:00', status: 'done',     sequence_order: 1 },
        { route_id: insertedRoutes[3].id, tenant_id: tenantId, stop_name: 'Patel Nagar',   scheduled_time: '08:20', status: 'done',     sequence_order: 2 },
        { route_id: insertedRoutes[3].id, tenant_id: tenantId, stop_name: 'Tilak Nagar',   scheduled_time: '08:45', status: 'current',  sequence_order: 3 },
        { route_id: insertedRoutes[3].id, tenant_id: tenantId, stop_name: 'Janakpuri Stn', scheduled_time: '09:05', status: 'upcoming', sequence_order: 4 },
      ];
      await supabase.from('transport_stops').insert(stops);
    }

    revalidatePath('/', 'layout');
    return { success: true, msg: 'Seeded' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── ADVANCED FLEET ANALYTICS (Fuel, Maintenance, Safety) ──────────────
export async function getFleetAnalytics() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    // Use simple queries without FK joins to avoid PostgREST relationship errors
    // Then manually enrich with route data in JS
    const [incidentRes, fuelRes, maintRes, routesRes] = await Promise.allSettled([
      supabase
        .from('transport_incidents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('reported_at', { ascending: false })
        .limit(5),
      supabase
        .from('transport_fuel_logs')
        .select('*')
        .eq('tenant_id', tenantId),
      supabase
        .from('transport_maintenance')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('next_due_date', { ascending: true }),
      supabase
        .from('transport_routes')
        .select('id, name, bus_number')
        .eq('tenant_id', tenantId),
    ]);

    // Build route lookup map
    const routes: Record<string, { name: string; bus_number: string }> = {};
    if (routesRes.status === 'fulfilled' && routesRes.value.data) {
      for (const r of routesRes.value.data) {
        routes[r.id] = { name: r.name, bus_number: r.bus_number };
      }
    }

    const incidents = incidentRes.status === 'fulfilled' ? (incidentRes.value.data ?? []) : [];
    const fuelLogs  = fuelRes.status  === 'fulfilled' ? (fuelRes.value.data  ?? []) : [];
    const maintenance = maintRes.status === 'fulfilled' ? (maintRes.value.data ?? []) : [];

    // Enrich with route info manually
    const enrichedIncidents   = incidents.map(  (i: any) => ({ ...i, transport_routes: routes[i.route_id] ?? null }));
    const enrichedMaintenance = maintenance.map((m: any) => ({ ...m, transport_routes: routes[m.route_id] ?? null }));

    return {
      success: true,
      data: {
        totalFuelSpent: fuelLogs.reduce((a: number, b: any) => a + (b.total_cost || 0), 0),
        averageKMPL: 4.8,
        activeAlerts: incidents.length + maintenance.length,
        incidents: enrichedIncidents,
        maintenance: enrichedMaintenance,
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { Client } from "@upstash/qstash";

// Setup Rate Limiting
const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 m'), // 3 SOS alerts per minute
  analytics: true,
}) : null;

const alertSchema = z.object({
  message: z.string().min(10, "Message must be at least 10 characters long").max(500, "Message too long")
});

export async function broadcastTransportAlert(message: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  // Zod Validation
  const parsed = alertSchema.safeParse({ message });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // Rate Limiting
  if (ratelimit && user) {
    const { success } = await ratelimit.limit(`sos_alert_${user.id}`);
    if (!success) {
      return { success: false, error: 'SOS rate limit exceeded. Please wait a minute.' };
    }
  }

  try {
    const supabase = createClient();
    
    // Save to DB
    const { error } = await supabase.from('notices').insert({
      tenant_id: tenantId,
      title: 'Transport Alert 🚌',
      raw_content: parsed.data.message
    });

    if (error) throw error;

    // Trigger SMS to all parents linked to transport module
    if (process.env.QSTASH_TOKEN) {
      const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      
      await qstashClient.publishJSON({
        url: `${baseUrl}/api/jobs/send-transport-sos`,
        body: {
          message: parsed.data.message,
          tenantId: tenantId
        }
      });
    } else {
      console.warn('QSTASH_TOKEN missing. SOS SMS bypassed.');
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
