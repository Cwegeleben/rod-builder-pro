export function isAllowedShopifyOrigin(origin) {
  if (!origin) return false
  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:') return false
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'admin.shopify.com') return true
    return ['.myshopify.com', '.shopifypreview.com', '.spin.dev'].some(suffix => hostname.endsWith(suffix))
  } catch {
    return false
  }
}

export function appendVaryHeader(res, value) {
  const existing = res.getHeader?.('Vary')
  if (!existing) {
    res.setHeader?.('Vary', value)
    return
  }
  const tokens = existing
    .toString()
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
  if (!tokens.includes(value.toLowerCase())) {
    res.setHeader?.('Vary', `${existing}, ${value}`)
  }
}

export function withShopifyCors(req, res, next) {
  if (typeof next !== 'function') {
    throw new TypeError('next callback is required for withShopifyCors')
  }
  if (res.headersSent || res.getHeader?.('Access-Control-Allow-Origin')) {
    next()
    return
  }
  const origin = req.headers?.origin ?? null
  if (isAllowedShopifyOrigin(origin)) {
    res.setHeader?.('Access-Control-Allow-Origin', origin)
    appendVaryHeader(res, 'Origin')
  }
  next()
}
