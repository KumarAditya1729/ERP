import { Redis } from '@upstash/redis';

// Only initialize Redis if tokens are present to avoid crashing local MVP if not configured
export const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * 1M-USER SCALE: Serverless Cache Wrapper
 * 
 * To sustain 1M users, we cannot hit the DB for generic or slowly-changing data 
 * repeatedly (like school details, public notices, static lists).
 * 
 * @param tenantId unique school ID to strictly isolate cache keys
 * @param key unique cache key
 * @param fetcher function to get data if cache miss
 * @param ttlSeconds time to live
 */
export async function withCache<T>(
  tenantId: string,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  if (!redis) return fetcher(); // Fallback if Redis isn't deployed yet

  const namespacedKey = `tenant:${tenantId}:${key}`;

  try {
    const cached = await redis.get<T>(namespacedKey);
    if (cached) return cached;
    
    // Cache miss
    const data = await fetcher();
    
    // Non-blocking set
    redis.set(namespacedKey, data, { ex: ttlSeconds }).catch(console.error);
    return data;
  } catch (err) {
    console.error("Redis Cache Error:", err);
    return fetcher(); // Always fallback gracefully
  }
}
