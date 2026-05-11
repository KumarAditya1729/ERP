/**
 * lib/rate-limit.ts — Upstash Redis rate limiting helpers for NexSchool AI
 *
 * Provides reusable rate limiters and an `applyRateLimit()` helper
 * that extracts IP safely for Vercel and returns a 429 NextResponse when exceeded.
 *
 * Usage in any API route:
 *   const limited = await applyRateLimit(req);
 *   if (limited) return limited; // 429 with retryAfter
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// -----------------------------------------------------------------
// Singleton Redis — null-safe if env vars are missing (graceful fallback)
// -----------------------------------------------------------------
function makeRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

const redis = makeRedis();

// -----------------------------------------------------------------
// Rate limiters (sliding window)
// -----------------------------------------------------------------
function makeRatelimit(requests: number, window: string, prefix: string): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: `nexschool:${prefix}`,
  });
}

/** General API: 20 req / 10 s per IP */
export const apiRateLimit = makeRatelimit(20, '10 s', 'api');

/** Auth endpoints: 10 attempts / 15 min per IP */
export const authRateLimit = makeRatelimit(10, '15 m', 'auth');

/** Webhook endpoints: 100 req / 60 s (higher — provider retries) */
export const webhookRateLimit = makeRatelimit(100, '60 s', 'webhook');

/** Invoice / heavy write actions: 5 per minute per user */
export const writeRateLimit = makeRatelimit(5, '1 m', 'write');

// -----------------------------------------------------------------
// Helper: extract real IP from Vercel headers
// -----------------------------------------------------------------
export function getClientIp(req: Request): string {
  const headers = (req as any).headers as Headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

// -----------------------------------------------------------------
// Helper: apply rate limit and return 429 NextResponse if exceeded
// -----------------------------------------------------------------
export async function applyRateLimit(
  req: Request,
  limiter: Ratelimit | null = apiRateLimit,
): Promise<NextResponse | null> {
  if (!limiter) return null; // Redis not configured — skip silently

  const ip = getClientIp(req);
  const { success, limit, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
        },
      },
    );
  }

  return null;
}
