'use server';

import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

export async function getRecentNotifications() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin } = await getAdminClientAndTenant();

    // Fetch the 10 most recent audit logs as system notifications
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error && error.code !== 'PGRST116') throw error;
    
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
