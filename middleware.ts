import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'

// Initialize Redis only if keys are present
const rawRedisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/["']/g, '');
const rawRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/["']/g, '');
const redis = (rawRedisUrl && rawRedisUrl.startsWith('http') && rawRedisToken) 
  ? new Redis({ url: rawRedisUrl, token: rawRedisToken }) 
  : null;

// Rate limits — configurable via env vars, no redeployment needed
const RATE_LIMIT_SEC = parseInt(process.env.RATE_LIMIT_WINDOW ?? '60', 10);
const MAX_REQUESTS_API = parseInt(process.env.RATE_LIMIT_REQUESTS ?? '60', 10);
const MAX_REQUESTS_WEBHOOK = parseInt(process.env.RATE_LIMIT_WEBHOOK_REQUESTS ?? '10', 10);

export async function middleware(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // --- 1. RATE LIMITING (Edge Defense for API routes) ---
  if (isApiRoute && redis) {
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    
    let limit = MAX_REQUESTS_API;
    let prefix = 'ratelimit:api:';

    if (request.nextUrl.pathname.includes('/webhooks')) {
      limit = MAX_REQUESTS_WEBHOOK;
      prefix = 'ratelimit:webhook:';
    }

    const key = `${prefix}${ip}`;

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, RATE_LIMIT_SEC);
      const results = await pipeline.exec();

      // @ts-ignore
      const currentRequests = results[0] as number;

      if (currentRequests > limit) {
        return NextResponse.json(
          { error: 'Too Many Requests (Rate Limit Exceeded)' }, 
          { status: 429, headers: { 'X-RateLimit-Limit': limit.toString() } }
        );
      }
    } catch (error) {
      console.warn('[Redis RateLimiter] Failed cleanly, bypassing:', error);
    }
  }

  // --- 2. SUPABASE AUTHENTICATION (For App/Dashboard) ---
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // We don't need to refresh Supabase cookies for standard background API routes
  if (!isApiRoute) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // 3. RBAC (Role-Based Access Control) Routing Isolation
    const pathname = request.nextUrl.pathname;
    
    // Protect all internal routes from unauthenticated users
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/teacher') || pathname.startsWith('/portal') || pathname.startsWith('/staff')) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      // Only enforce strict role boundaries when we have an explicit role in JWT.
      // If app_metadata.role is absent (legacy users, fresh signups), allow through —
      // the server-side layouts are the second RBAC layer and handle this gracefully.
      const role = user.app_metadata?.role as string | undefined;
      
      if (role) {
        if (pathname.startsWith('/dashboard') && role !== 'admin') {
          const dest = (role === 'parent' || role === 'student') ? '/portal' : `/${role}`;
          return NextResponse.redirect(new URL(dest, request.url));
        }
        if (pathname.startsWith('/teacher') && role !== 'teacher') {
          return NextResponse.redirect(new URL(role === 'admin' ? '/dashboard' : '/portal', request.url));
        }
        if (pathname.startsWith('/staff') && role !== 'staff') {
          return NextResponse.redirect(new URL(role === 'admin' ? '/dashboard' : '/portal', request.url));
        }
      }

      // --- 3b. BILLING GATE — Block expired tenants from accessing the product ---
      // Only admins manage billing. Teachers/staff/parents are never blocked.
      const isProductRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/teacher') || pathname.startsWith('/staff');
      if (isProductRoute && role === 'admin') {
        const subscriptionStatus = user.app_metadata?.subscription_status as string | undefined;
        const trialEndsAt = user.app_metadata?.trial_ends_at as string | undefined;

        const isExpiredTrial = subscriptionStatus === 'trial' && trialEndsAt && new Date(trialEndsAt) < new Date();
        const isPastDue = subscriptionStatus === 'past_due';

        if (isExpiredTrial || isPastDue) {
          return NextResponse.redirect(new URL('/billing', request.url));
        }
      }
    }

    // If logging in while already authenticated, push them to their specific product!
    if (pathname === '/login' && user) {
      const role = user.app_metadata?.role || 'parent';
      if (role === 'admin') return NextResponse.redirect(new URL('/dashboard', request.url));
      if (role === 'teacher') return NextResponse.redirect(new URL('/teacher', request.url));
      if (role === 'staff') return NextResponse.redirect(new URL('/staff', request.url));
      return NextResponse.redirect(new URL('/portal', request.url));
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
