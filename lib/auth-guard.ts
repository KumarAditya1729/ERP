import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabasePublicEnv } from '@/lib/env'

export type AllowedRole = 'admin' | 'teacher' | 'staff' | 'parent' | 'student' | 'warden'

export async function requireAuth(allowedRoles?: AllowedRole[]) {
  const supabaseEnv = getSupabasePublicEnv()
  if (!supabaseEnv) {
    return {
      user: null,
      role: null,
      tenantId: null,
      error: NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 }),
    }
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )

  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return { user: null, role: null, tenantId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const role = (user.app_metadata?.role || user.user_metadata?.role) as AllowedRole | undefined
    if (allowedRoles && (!role || !allowedRoles.includes(role))) {
      return { user: null, role: role ?? null, tenantId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    return {
      user,
      role: role ?? null,
      tenantId: user.app_metadata?.tenant_id || user.user_metadata?.tenant_id || null,
      error: null,
    }
  } catch (error) {
    console.error('[Auth Guard] Failed to resolve session:', error)
    return {
      user: null,
      role: null,
      tenantId: null,
      error: NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 }),
    }
  }
}
