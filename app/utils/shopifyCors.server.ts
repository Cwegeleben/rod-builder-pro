const SHOPIFY_HOST_SUFFIXES = ['.myshopify.com', '.shopifypreview.com', '.spin.dev'] as const
const SHOPIFY_HOSTS = new Set(['admin.shopify.com'])

function isAllowedShopifyOrigin(origin: string | null): origin is string {
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (SHOPIFY_HOSTS.has(host)) return true
    return SHOPIFY_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
  } catch {
    return false
  }
}

function appendVary(headers: Headers, value: string) {
  const existing = headers.get('Vary')
  if (!existing) {
    headers.set('Vary', value)
    return
  }
  const tokens = existing
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
  if (!tokens.includes(value.toLowerCase())) {
    headers.set('Vary', `${existing}, ${value}`)
  }
}

function applyCorsOrigin(request: Request, headers: Headers) {
  const origin = request.headers.get('origin')
  if (!isAllowedShopifyOrigin(origin)) return
  headers.set('Access-Control-Allow-Origin', origin)
  appendVary(headers, 'Origin')
}

export function ensureShopifyCorsHeaders(request: Request, target: Headers, extraHeaders?: HeadersInit): Headers {
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => target.set(key, value))
  }
  applyCorsOrigin(request, target)
  return target
}

export function buildShopifyCorsHeaders(request: Request, extraHeaders?: HeadersInit): Headers {
  const headers = new Headers()
  ensureShopifyCorsHeaders(request, headers, extraHeaders)
  return headers
}
