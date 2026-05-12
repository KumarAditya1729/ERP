'use server';

import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Removed getAdminClientAndTenant to fix N+1 query

export async function getRecentNotifications() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    // Fetch the 10 most recent audit logs as system notifications
    const { data, error } = await supabase
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
