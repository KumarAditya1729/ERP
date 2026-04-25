import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { i18n, type Locale } from '@/i18n.config'
import { getSupabasePublicEnv } from '@/lib/env'

// ⚠️ EDGE SAFE (NO nodejs imports)
// Subdomain parsing, Session refresh, RBAC blocking, and i18n Locale resolution

function getLocaleFromRequest(req: NextRequest): Locale {
  // 1. Check if a locale is already in the URL path
  const pathname = req.nextUrl.pathname;
  const localeFromPath = i18n.locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  if (localeFromPath) return localeFromPath;

  // 2. Negotiate locale from Accept-Language header
  const acceptLanguage = req.headers.get('Accept-Language') || '';
  const preferredLocale = acceptLanguage
    .split(',')
    .map((l) => l.split(';')[0].trim().substring(0, 2).toLowerCase())
    .find((lang) => i18n.locales.includes(lang as Locale));

  return (preferredLocale as Locale) || i18n.defaultLocale;
}

function pathnameHasLocale(pathname: string): boolean {
  return i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip for Next.js internals, static assets, and API routes
  if (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.includes('/favicon.ico') ||
    path.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // ── Tenant Subdomain Extraction ───────────────────────────────────────────
  const host = req.headers.get('host') || ''
  const parts = host.split('.')
  let tenantSubdomain = 'www'

  if (host.includes('.vercel.app')) {
    // Vercel deployment URLs should be treated as the main domain
    tenantSubdomain = 'www'
  } else if (parts.length > 2) {
    tenantSubdomain = parts[0]
  } else if (parts.length === 2 && host.includes('localhost')) {
    tenantSubdomain = parts[0]
  }

  // ── Locale Detection & Redirect ───────────────────────────────────────────
  if (!pathnameHasLocale(path)) {
    const locale = getLocaleFromRequest(req);
    const newUrl = req.nextUrl.clone();
    newUrl.pathname = `/${locale}${path}`;
    const redirectRes = NextResponse.redirect(newUrl);
    redirectRes.headers.set('x-tenant-subdomain', tenantSubdomain);
    return redirectRes;
  }

  // Extract the locale from the pathname (e.g. /en/dashboard => 'en')
  const locale = path.split('/')[1] as Locale;

  let res = NextResponse.next({
    request: { headers: req.headers },
  });
  res.headers.set('x-tenant-subdomain', tenantSubdomain);
  res.headers.set('x-locale', locale);

  const isPublic =
    path === `/${locale}` ||
    path.startsWith(`/${locale}/login`) ||
    path.startsWith(`/${locale}/signup`) ||
    path.startsWith(`/${locale}/register`) ||
    path.startsWith(`/${locale}/portal`) ||
    path.startsWith(`/${locale}/unauthorized`);

  const supabaseEnv = getSupabasePublicEnv()
  if (!supabaseEnv) {
    if (isPublic) return res
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  }

  // ── Supabase Auth Session Refresh ─────────────────────────────────────────
  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.headers.set('x-tenant-subdomain', tenantSubdomain)
          res.headers.set('x-locale', locale)
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.headers.set('x-tenant-subdomain', tenantSubdomain)
          res.headers.set('x-locale', locale)
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let user = null

  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    console.error('[Middleware] Failed to refresh session:', error)
    if (isPublic) {
      return res
    }
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  }

  if (tenantSubdomain !== 'www' && !path.includes('not-found')) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('subdomain', tenantSubdomain)
      .single()

    if (!tenant || tenant.status !== 'active') {
      return NextResponse.redirect(new URL(`/${locale}/not-found`, req.url))
    }
    // Now set x-tenant-id header with the real UUID
    res.headers.set('x-tenant-id', tenant.id)
  }

  if (isPublic) return res;

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  }

  const role = user.app_metadata?.role || user.user_metadata?.role

  if (!role) {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
  }

  // ── RBAC guards (allowlist-based, locale-aware) ─────────────────────────────
  // Define route access by role (allowlist approach)
  const roleRoutes: Record<string, string[]> = {
    admin: [
      `/${locale}/dashboard`,
      `/${locale}/teacher`,
      `/${locale}/staff`,
      `/${locale}/students`,
      `/${locale}/fees`,
      `/${locale}/reports`,
      `/${locale}/settings`,
      `/${locale}/admissions`,
      `/${locale}/attendance`,
      `/${locale}/academics`,
      `/${locale}/hostel`,
      `/${locale}/transport`,
      `/${locale}/hr`,
      `/${locale}/communication`,
    ],
    teacher: [
      `/${locale}/teacher`,
      `/${locale}/students`,
      `/${locale}/attendance`,
      `/${locale}/academics`,
      `/${locale}/reports`,
    ],
    staff: [
      `/${locale}/staff`,
      `/${locale}/students`,
      `/${locale}/fees`,
      `/${locale}/attendance`,
      `/${locale}/reports`,
    ],
    parent: [
      `/${locale}/portal`,
      `/${locale}/students`,
      `/${locale}/fees`,
      `/${locale}/attendance`,
      `/${locale}/reports`,
    ],
  };

  // Check if user has access to the requested path
  const allowedRoutes = roleRoutes[role] || [];
  const hasAccess = allowedRoutes.some(route => path.startsWith(route));

  if (!hasAccess) {
    console.log(`RBAC: User with role '${role}' denied access to path '${path}'`);
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
  }

  return res
}

export const config = {
  matcher: [
    // Match all paths except static Next.js files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
