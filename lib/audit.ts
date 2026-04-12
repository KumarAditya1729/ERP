import { supabase } from './supabaseClient'

export async function logAction(userId: string, action: string) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
  })
}
