export function getTenantId() {
  if (typeof window === 'undefined') return null

  const host = window.location.host
  const subdomain = host.split('.')[0]

  return subdomain
}
