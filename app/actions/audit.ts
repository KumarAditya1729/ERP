'use server';

import { createClient } from '@/lib/supabase/server';
export async function getAuditLogs(filters?: {
  action?: string;
  resource_type?: string;
  severity?: string;
  search?: string;
  limit?: number;
}) {
  const supabase = createClient();

  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      user:profiles ( id, first_name, last_name, role )
    `)
    .order('created_at', { ascending: false });

  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.resource_type) query = query.eq('resource_type', filters.resource_type);
  if (filters?.severity) query = query.eq('severity', filters.severity);
  
  if (filters?.search) {
    query = query.or(`actor_name.ilike.%${filters.search}%,resource_label.ilike.%${filters.search}%`);
  }

  query = query.limit(filters?.limit || 100);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching audit logs:', error);
    return { error: error.message };
  }

  return { logs: data || [] };
}
