// <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 -->
import { authenticate } from '../shopify.server'

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
  try {
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
