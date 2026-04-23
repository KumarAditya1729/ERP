import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type AllowedRole = 'admin' | 'teacher' | 'staff' | 'parent' | 'student'

export async function requireAuth(allowedRoles?: AllowedRole[]) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = user.app_metadata?.role as AllowedRole
  if (allowedRoles && !allowedRoles.includes(role)) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, role, tenantId: user.app_metadata?.tenant_id, error: null }
}
