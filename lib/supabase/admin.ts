import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from '@/lib/env'

let adminClient: SupabaseClient | null | undefined

export function getSupabaseAdminClient() {
  if (adminClient !== undefined) {
    return adminClient
  }

  const supabaseEnv = getSupabasePublicEnv()
  const serviceRoleKey = getSupabaseServiceRoleKey()

  adminClient =
    supabaseEnv && serviceRoleKey
      ? createClient(supabaseEnv.url, serviceRoleKey)
      : null

  return adminClient
}

// Keep the existing import surface while failing lazily at request time.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdminClient()
    if (!client) {
      throw new Error('Supabase admin client is not configured')
    }

    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
