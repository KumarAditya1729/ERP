export function isConfiguredValue(value?: string | null): value is string {
  if (!value) return false

  const normalized = value.trim()
  if (!normalized) return false

  return !(
    normalized.startsWith('YOUR_') ||
    normalized === 'placeholder' ||
    normalized.includes('placeholder.supabase.co')
  )
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!isConfiguredValue(url) || !isConfiguredValue(anonKey)) {
    return null
  }

  return { url, anonKey }
}

export function getSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return isConfiguredValue(serviceRoleKey) ? serviceRoleKey : null
}

export function getUpstashRedisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!isConfiguredValue(url) || !isConfiguredValue(token)) {
    return null
  }

  return { url, token }
}

export function getOptionalSecret(name: string) {
  const value = process.env[name]
  return isConfiguredValue(value) ? value : null
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}
