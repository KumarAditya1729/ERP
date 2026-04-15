import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { i18n, type Locale } from '@/i18n.config'

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

  // Skip for Next.js internals and static assets
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('/favicon.ico') ||
    path.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // ── Tenant Subdomain Extraction ───────────────────────────────────────────
  const host = req.headers.get('host') || ''
  const parts = host.split('.')
  let tenantSubdomain = 'www'

  if (parts.length > 2) {
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

  // ── Supabase Auth Session Refresh ─────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const { data: { user } } = await supabase.auth.getUser()

  // ── Public routes (locale-prefixed) ──────────────────────────────────────
  const isPublic =
    path.match(`^/${locale}/login`) ||
    path.match(`^/${locale}/signup`) ||
    path.match(`^/${locale}/register`) ||
    path.match(`^/${locale}/portal`) ||
    path === `/${locale}`;

  if (isPublic) return res;

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  }

  const role = user.app_metadata?.role

  if (!role) {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
  }

  // ── RBAC guards (locale-aware) ────────────────────────────────────────────
  if (path.startsWith(`/${locale}/dashboard`) && role !== 'admin') {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
  }
  if (path.startsWith(`/${locale}/teacher`) && role !== 'teacher') {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
  }
  if (path.startsWith(`/${locale}/staff`) && role !== 'staff') {
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
