import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getUpstashRedisEnv } from '@/lib/env'

type BucketName = 'api' | 'auth' | 'webhook'

type RateLimitResult = Awaited<ReturnType<Ratelimit['limit']>>

const noopRateLimitResult = { success: true } as RateLimitResult

const bucketConfig: Record<
  BucketName,
  { limit: number; window: `${number} ${'s' | 'm' | 'h'}`; prefix: string }
> = {
  api: {
    limit: 60,
    window: '60 s',
    prefix: 'nexschool:api',
  },
  auth: {
    limit: 10,
    window: '15 m',
    prefix: 'nexschool:auth',
  },
  webhook: {
    limit: 30,
    window: '60 s',
    prefix: 'nexschool:webhook',
  },
}

let redisClient: Redis | null | undefined
const limiters: Partial<Record<BucketName, Ratelimit | null>> = {}

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient
  }

  const env = getUpstashRedisEnv()
  redisClient = env ? new Redis(env) : null
  return redisClient
}

function getLimiter(bucket: BucketName) {
  if (bucket in limiters) {
    return limiters[bucket] ?? null
  }

  const redis = getRedisClient()
  if (!redis) {
    limiters[bucket] = null
    return null
  }

  const config = bucketConfig[bucket]
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    analytics: true,
    prefix: config.prefix,
  })

  limiters[bucket] = limiter
  return limiter
}

async function limit(bucket: BucketName, key: string): Promise<RateLimitResult> {
  const limiter = getLimiter(bucket)
  if (!limiter) {
    return noopRateLimitResult
  }

  return limiter.limit(key)
}

function createBucket(bucket: BucketName) {
  return {
    limit: (key: string) => limit(bucket, key),
  }
}

export const apiRateLimit = createBucket('api')
export const authRateLimit = createBucket('auth')
export const webhookRateLimit = createBucket('webhook')
