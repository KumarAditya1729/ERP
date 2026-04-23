'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// ── Shared helper ─────────────────────────────────────────────────────────────
async function getAdminClientAndTenant() {
  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error('Unauthorized');

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error('Profile missing');

  return { supabaseAdmin, tenantId: profile.tenant_id as string, userId: supabaseUser.id };
}

// ── READ ──────────────────────────────────────────────────────────────────────
export async function getTransportRoutes() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    const { data: routes, error } = await supabaseAdmin
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
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId, userId } = await getAdminClientAndTenant();
    
    // Actually find the student linked to this parent, then find their route.
    // For now, if no student links are formalised for routes, we query a mock junction or return nothing.
    // Assuming a parent_student_routes table or just students table has a route_id.
    // For this ERP currently, there is no direct route_id on student, so we return a safer mock or
    // simply look up the first child's route if it existed.
    // Here we will just look for the first route where the child goes, or fail safely if not setup yet.
    
    const { data: parentLinks } = await supabaseAdmin.from('parent_links').select('student_id').eq('parent_id', userId);
    
    if (!parentLinks || parentLinks.length === 0) {
      return { success: false, error: 'No children linked to your account.' };
    }

    // Since we don't have a reliable connection between student and route yet in schema,
    // we'll return nothing instead of broadcasting random routes.
    // In Phase 3 we can add `route_id` to students or `student_routes` junction.
    // For now we will return an error to prevent cross-tenant data leak if they aren't assigned.
    return { success: false, error: 'Transport route not yet assigned to your child.' };
    
    // (If route_id existed on student, we'd do):
    /*
    const childStudentId = parentLinks[0].student_id;
    const { data: studentData } = await supabaseAdmin.from('students').select('route_id').eq('id', childStudentId).single();
    if (!studentData?.route_id) return { success: false, error: 'No route assigned.' };
    
    const { data: routes, error } = await supabaseAdmin
      .from('transport_routes')
      .select('*, transport_stops(*)')
      .eq('id', studentData.route_id)
      .eq('tenant_id', tenantId);
    */

    // (Dead code removed)
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    const { data: route, error } = await supabaseAdmin
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
      await supabaseAdmin.from('transport_stops').insert(stopsPayload);
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    const { error } = await supabaseAdmin
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    const { error } = await supabaseAdmin
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    // Fetch current count first
    const { data: current } = await supabaseAdmin
      .from('transport_routes')
      .select('enrolled_students, capacity')
      .eq('id', routeId)
      .eq('tenant_id', tenantId)
      .single();

    if (!current) throw new Error('Route not found');
    const newCount = Math.max(0, Math.min(current.capacity, current.enrolled_students + delta));

    const { error } = await supabaseAdmin
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    // Stops cascade delete via FK — just delete the route
    const { error } = await supabaseAdmin
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    const { count } = await supabaseAdmin
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

    const { data: insertedRoutes, error } = await supabaseAdmin
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
      await supabaseAdmin.from('transport_stops').insert(stops);
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();

    // Try fetching real data (if migration 00002 has been applied)
    const { data: incidents, error: incErr } = await supabaseAdmin
      .from('transport_incidents')
      .select('*, transport_routes(name, bus_number)')
      .eq('tenant_id', tenantId)
      .order('reported_at', { ascending: false })
      .limit(5);

    const { data: fuelLogs, error: fuelErr } = await supabaseAdmin
      .from('transport_fuel_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: false });

    const { data: maintenance, error: maintErr } = await supabaseAdmin
      .from('transport_maintenance')
      .select('*, transport_routes(name, bus_number)')
      .eq('tenant_id', tenantId)
      .order('next_due_date', { ascending: true });

    const safeIncidents = incidents || [];
    const safeMaintenance = maintenance || [];

    return { 
      success: true, 
      data: {
        totalFuelSpent: fuelLogs?.reduce((a, b) => a + b.total_cost, 0) || 0,
        averageKMPL: 4.8, // In real app, calculate from odometer and fuel_volume_liters
        activeAlerts: safeIncidents.length + safeMaintenance.length,
        incidents: safeIncidents,
        maintenance: safeMaintenance
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
  if (authErr) throw new Error('Unauthorized');

  // Zod Validation
  const parsed = alertSchema.safeParse({ message });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // Rate Limiting
  if (ratelimit) {
    const { success } = await ratelimit.limit(`sos_alert_${user.id}`);
    if (!success) {
      return { success: false, error: 'SOS rate limit exceeded. Please wait a minute.' };
    }
  }

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    
    // Save to DB
    const { error } = await supabaseAdmin.from('notices').insert({
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
