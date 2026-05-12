'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-guard'

export async function purgeDemoData() {
  const { tenantId, error: authErr } = await requireAuth(['admin']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };

  const supabase = createClient();

  try {
    console.log(`[Production] Purging demo data for tenant: ${tenantId}`);

    // 1. Delete students (cascades to attendance, fees, etc. if FKs are set to CASCADE)
    const { error: sErr } = await supabase.from('students').delete().eq('tenant_id', tenantId);
    if (sErr) throw sErr;

    // 2. Delete hostel rooms
    const { error: hErr } = await supabase.from('hostel_rooms').delete().eq('tenant_id', tenantId);
    if (hErr) throw hErr;

    // 3. Delete exams
    const { error: eErr } = await supabase.from('exams').delete().eq('tenant_id', tenantId);
    if (eErr) throw eErr;

    // 4. Delete notices
    const { error: nErr } = await supabase.from('notices').delete().eq('tenant_id', tenantId);
    if (nErr) throw nErr;

    // 5. Delete Transport & GPS data
    await supabase.from('transport_fuel_logs').delete().eq('tenant_id', tenantId);
    await supabase.from('transport_maintenance').delete().eq('tenant_id', tenantId);
    await supabase.from('transport_incidents').delete().eq('tenant_id', tenantId);
    await supabase.from('transport_stops').delete().eq('tenant_id', tenantId);
    await supabase.from('transport_routes').delete().eq('tenant_id', tenantId);
    await supabase.from('gps_pings').delete().eq('tenant_id', tenantId);
    await supabase.from('gps_vehicles').delete().eq('tenant_id', tenantId);

    // 6. Delete extra staff profiles (except current admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { error: pErr } = await supabase.from('profiles').delete().eq('tenant_id', tenantId).neq('id', user.id);
        if (pErr) throw pErr;
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    console.error('[Production] Purge failed:', err);
    return { success: false, error: err.message };
  }
}
