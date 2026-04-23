import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const apiRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  analytics: true,
  prefix: 'nexschool:api',
})

export const authRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  analytics: true,
  prefix: 'nexschool:auth',
})

export const webhookRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'nexschool:webhook',
})
