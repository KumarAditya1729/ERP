import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// ⚠️ EDGE SAFE (NO nodejs imports)
// Subdomain parsing and RBAC blocking

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // 🔥 PHASE 3: SUBDOMAIN HANDLER
  const host = req.headers.get('host') || ''
  const subdomain = host.split('.')[0]
  const isLocal = host.includes('localhost')
  
  let tenantSubdomain = subdomain
  if (isLocal) {
    tenantSubdomain = subdomain
  }
  
  // We can inject Tenant resolution directly in Server Components using headers
  res.headers.set('x-tenant-subdomain', tenantSubdomain)

  // Initialize Supabase Auth for the request
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname

  // 🔒 Public routes
  if (
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/portal') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico')
  ) {
    return res
  }

  // 🚫 Not logged in
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const role = user.app_metadata?.role

  // 🚫 No role → BLOCK (CRITICAL FIX)
  if (!role) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // 🔐 Role-based routing
  if (path.startsWith('/dashboard') && role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (path.startsWith('/teacher') && role !== 'teacher') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (path.startsWith('/student') && role !== 'student') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (path.startsWith('/staff') && role !== 'staff') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/staff/:path*',
  ],
}
