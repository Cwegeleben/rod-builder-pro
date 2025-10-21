// <!-- BEGIN RBP GENERATED: importer-seeds-v1 -->
const DROP_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
])

export function normalizeUrl(raw: string, base = 'https://batsonenterprises.com'): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw, base)
    u.hash = ''
    for (const k of Array.from(u.searchParams.keys())) if (DROP_QUERY_KEYS.has(k)) u.searchParams.delete(k)
    const path = u.pathname.replace(/\/+$/g, '') || '/'
    u.pathname = path
    // Coerce to HTTPS
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.toString()
  } catch {
    return null
  }
}
// <!-- END RBP GENERATED: importer-seeds-v1 -->
