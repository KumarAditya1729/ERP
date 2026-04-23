'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache'

async function getAdminClientAndTenant() {
  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error('Unauthorized');

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error('Profile not found');

  return { supabaseAdmin, user: supabaseUser, profile, tenantId: profile.tenant_id as string };
}

export async function getHostelRooms() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    
    const { data, error } = await supabaseAdmin
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    
    // Check if rooms already exist
    const { count } = await supabaseAdmin
      .from('hostel_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
      
    if (count && count > 0) return { success: true, message: 'Already seeded' };

    const demoRooms = [
      { tenant_id: tenantId, room_number: '101', type: 'Standard', capacity: 3, floor: '1', occupied: 3 },
      { tenant_id: tenantId, room_number: '102', type: 'Standard', capacity: 3, floor: '1', occupied: 2 },
      { tenant_id: tenantId, room_number: '103', type: 'Standard', capacity: 3, floor: '1', occupied: 0 },
      { tenant_id: tenantId, room_number: '201', type: 'Deluxe', capacity: 2, floor: '2', occupied: 2 },
      { tenant_id: tenantId, room_number: '202', type: 'Deluxe', capacity: 2, floor: '2', occupied: 1 },
      { tenant_id: tenantId, room_number: '203', type: 'Premium', capacity: 1, floor: '2', occupied: 0 }
    ];

    const { error } = await supabaseAdmin.from('hostel_rooms').insert(demoRooms);
    if (error) throw error;
    
    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true, message: 'Seeded successfully' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
