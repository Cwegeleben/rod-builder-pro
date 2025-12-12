const SHOPIFY_HOST_PATTERN = /\.myshopify\.com$/i

function extractHost(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).host
  } catch {
    return value.replace(/^[^/]+:\/\//, '').split('/')[0] || null
  }
}

function isShopifyHost(host: string | null | undefined): boolean {
  if (!host) return false
  const normalized = host.toLowerCase()
  return SHOPIFY_HOST_PATTERN.test(normalized)
}

function envAssetBase(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.PUBLIC_ASSET_BASE_URL ||
    process.env.SHOPIFY_APP_URL ||
    ''
  )
}

function inferOriginFromRequest(request: Request): string {
  try {
    const { origin } = new URL(request.url)
    return origin
  } catch {
    return ''
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function isAbsoluteUrl(value: string): boolean {
  try {
    return Boolean(new URL(value))
  } catch {
    return false
  }
}

export function resolveAssetBaseUrl(request: Request): string {
  const headers = request.headers
  const forwardedProto = headers.get('x-forwarded-proto') ?? headers.get('fly-forwarded-proto')
  const forwardedHost = headers.get('x-forwarded-host') ?? headers.get('host')
  const normalizedProto = forwardedProto?.toLowerCase()
  if (normalizedProto === 'https' && forwardedHost && !isShopifyHost(forwardedHost)) {
    return `https://${forwardedHost}`
  }

  const envOrigin = envAssetBase()
  if (envOrigin) {
    return envOrigin
  }

  const candidateFromHeaders = forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : ''
  const candidateFromRequest = inferOriginFromRequest(request)

  if (candidateFromHeaders && !isShopifyHost(forwardedHost)) {
    return candidateFromHeaders
  }
  if (candidateFromRequest && !isShopifyHost(extractHost(candidateFromRequest))) {
    return candidateFromRequest
  }
  if (envOrigin) {
    return envOrigin
  }
  return candidateFromHeaders || candidateFromRequest || ''
}

export function resolveAbsoluteAssetPublicPath(request: Request, publicPath: string | undefined): string {
  const current = publicPath || '/'
  if (isAbsoluteUrl(current)) {
    return ensureTrailingSlash(current)
  }
  const base = resolveAssetBaseUrl(request)
  if (!base) {
    return ensureTrailingSlash(current)
  }
  try {
    const absolute = new URL(current, ensureTrailingSlash(base)).toString()
    return ensureTrailingSlash(absolute)
  } catch {
    return ensureTrailingSlash(current)
  }
}
