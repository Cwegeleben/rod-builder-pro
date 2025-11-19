// <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 -->
// NOTE: Dynamic import to avoid loading full Shopify + Prisma stack in lightweight unit tests
// Functions that don't need authenticate (isHqShopDomain, requireHqShopOr404 when overridden) can run without heavy deps.
let _authenticate: typeof import('../shopify.server').authenticate | null = null
async function getAuthenticate() {
  if (_authenticate) return _authenticate
  const mod = await import('../shopify.server')
  _authenticate = mod.authenticate
  return _authenticate
}

/** Normalize a shop domain to bare prefix (strip .myshopify.com) */
function normalizeShop(shop?: string | null): string | null {
  if (!shop) return null
  const lower = shop.toLowerCase()
  return lower.endsWith('.myshopify.com') ? lower.replace('.myshopify.com', '') : lower
}
/**
 * Load the list of allowed HQ shops from env (CSV), falling back to the default.
 * Accepts either full myshopify domains or bare prefixes; everything is normalized to bare.
 * Example: HQ_SHOPS="rbp-hq-dev,my-prod-hq,rbp-hq-dev.myshopify.com"
 */
function loadHqBares(): string[] {
  const raw = process.env.HQ_SHOPS
  const fallback = ['rbp-hq-dev']
  if (!raw) return fallback
  return raw
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => normalizeShop(s) || '')
    .filter(Boolean) as string[]
}
const HQ_BARES = loadHqBares()
const HQ_REGEX: RegExp | null = (() => {
  const src = process.env.HQ_SHOPS_REGEX
  if (!src) return null
  try {
    return new RegExp(src)
  } catch {
    return null
  }
})()

export function isHqShopDomain(shop: string | null | undefined): boolean {
  const norm = normalizeShop(shop)
  if (!norm) return false
  if (HQ_REGEX && HQ_REGEX.test(norm)) return true
  return HQ_BARES.includes(norm)
}

export async function isHqShop(request: Request): Promise<boolean> {
  // Fast-path: explicit bypass / override signals (intended for e2e, smoke, preflight diagnostics) when enabled.
  // Hard off switch: ALLOW_HQ_OVERRIDE must be '1' OR legacy always-on (for local dev) if ALLOW_HQ_OVERRIDE is undefined and NODE_ENV !== 'production'.
  const allowOverrideEnv = process.env.ALLOW_HQ_OVERRIDE === '1'
  const implicitDev =
    typeof process !== 'undefined' && process.env.NODE_ENV !== 'production' && process.env.ALLOW_HQ_OVERRIDE !== '0'
  const allowOverride = allowOverrideEnv || implicitDev

  // Secondary high-security bypass via shared secret token (never echoed) for CI where env flag may be off.
  // Provide HQ_BYPASS_TOKEN=<secret>; request must send header x-hq-bypass: <secret>.
  const bypassToken = process.env.HQ_BYPASS_TOKEN || ''

  try {
    const url = new URL(request.url)
    const cookie = request.headers.get('cookie') || ''
    const h = (name: string) => request.headers.get(name) || ''

    // Token header has highest precedence.
    if (bypassToken && h('x-hq-bypass') === bypassToken) return true

    if (allowOverride) {
      const viaQuery = url.searchParams.get('hq') === '1' || url.searchParams.get('hqBypass') === '1'
      const viaCookie = /(?:^|;\s*)rbp_hq=1(?:;|$)/.test(cookie) || /(?:^|;\s*)rbp_hq_bypass=1(?:;|$)/.test(cookie)
      const viaHeader = h('x-hq-override') === '1' || h('x-hq-bypass') === '1'
      if (viaQuery || viaCookie || viaHeader) return true
    }
  } catch {
    // ignore URL parse errors
  }

  // Fallback: real authenticated shop check.
  try {
    const authenticate = await getAuthenticate()
    const { session } = await authenticate.admin(request)
    const rawShop = (session as unknown as { shop?: string }).shop
    return isHqShopDomain(rawShop)
  } catch {
    return false
  }
}

/** Throws 404 if the requesting shop is not HQ */
export async function requireHqShopOr404(request: Request): Promise<void> {
  const ok = await isHqShop(request)
  if (!ok) throw new Response('Not Found', { status: 404 })
}
// <!-- END RBP GENERATED: supplier-importer-ui-v1 -->
