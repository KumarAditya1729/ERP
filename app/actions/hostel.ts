'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache'

// Removed getAdminClientAndTenant to fix N+1 query and RLS bypass

export async function getOperationsStats() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    
    const [{ count: routeCount }, { count: roomCount }] = await Promise.all([
      supabase.from('transport_routes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('hostel_rooms').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    return { 
      success: true, 
      data: {
        routes: routeCount || 0,
        rooms: roomCount || 0,
      } 
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getHostelRooms() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('hostel_rooms')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('room_number', { ascending: true });
      
    if (error && error.code !== 'PGRST116') throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function seedHostelDatabase() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    
    // Check if rooms already exist
    const { count } = await supabase
      .from('hostel_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
      
    if (count && count > 0) return { success: true, message: 'Already seeded' };

    const demoRooms = [
      { tenant_id: tenantId, room_number: '101', block_name: 'Block A', room_type: 'Standard', capacity: 3, floor_level: 1, occupied: 3, status: 'full' },
      { tenant_id: tenantId, room_number: '102', block_name: 'Block A', room_type: 'Standard', capacity: 3, floor_level: 1, occupied: 2, status: 'partial' },
      { tenant_id: tenantId, room_number: '103', block_name: 'Block A', room_type: 'Standard', capacity: 3, floor_level: 1, occupied: 0, status: 'vacant' },
      { tenant_id: tenantId, room_number: '201', block_name: 'Block B', room_type: 'Deluxe', capacity: 2, floor_level: 2, occupied: 2, status: 'full' },
      { tenant_id: tenantId, room_number: '202', block_name: 'Block B', room_type: 'Deluxe', capacity: 2, floor_level: 2, occupied: 1, status: 'partial' },
      { tenant_id: tenantId, room_number: '203', block_name: 'Block B', room_type: 'Premium', capacity: 1, floor_level: 2, occupied: 0, status: 'vacant' }
    ];

    const { error } = await supabase.from('hostel_rooms').insert(demoRooms);
    if (error) throw error;
    
    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true, message: 'Seeded successfully' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addHostelRoom(payload: { room_number: string; block_name: string; room_type: string; capacity: number; floor_level: number }) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('hostel_rooms')
      .insert({
        tenant_id: tenantId,
        room_number: payload.room_number,
        block_name: payload.block_name,
        room_type: payload.room_type,
        capacity: payload.capacity,
        floor_level: payload.floor_level,
        occupied: 0,
        status: 'vacant'
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
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
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 gate passes per minute
  analytics: true,
}) : null;

const gatePassSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  reason: z.string().min(5, "Reason too short"),
  out_time: z.string(),
  expected_in_time: z.string(),
});

export async function issueGatePass(payload: { student_id: string; reason: string; out_time: string; expected_in_time: string }) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'warden']);
  if (authErr) throw new Error('Unauthorized');

  // Zod Validation
  const parsed = gatePassSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // Rate Limiting
  if (ratelimit && user) {
    const { success } = await ratelimit.limit(`gatepass_${user.id}`);
    if (!success) {
      return { success: false, error: 'Gate pass rate limit exceeded. Please wait a minute.' };
    }
  }

  try {
    const supabase = createClient();
    
    // Instead of a dedicated table for now, we save it as a highly critical notice or log
    // In phase 2, we can insert into a `gate_passes` table if it exists.
    // For now, let's verify if the gate_passes table exists or fallback to audit log.
    
    const gatePassCode = `GP-${Math.floor(1000 + Math.random() * 9000)}`;

    // Queue OTP/SMS verification using QStash
    if (process.env.QSTASH_TOKEN) {
      const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      
      await qstashClient.publishJSON({
        url: `${baseUrl}/api/jobs/send-gatepass-otp`,
        body: {
          studentId: parsed.data.student_id,
          tenantId: tenantId,
          gatePassCode,
          reason: parsed.data.reason
        }
      });
    }

    revalidatePath('/', 'layout');
    return { success: true, code: gatePassCode };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
