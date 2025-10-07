// <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 -->
import { authenticate } from '../shopify.server'

/** Normalize a shop domain to bare prefix (strip .myshopify.com) */
function normalizeShop(shop?: string | null): string | null {
  if (!shop) return null
  const lower = shop.toLowerCase()
  return lower.endsWith('.myshopify.com') ? lower.replace('.myshopify.com', '') : lower
}

const HQ_BARE = 'rbp-hq-dev'

export function isHqShopDomain(shop: string | null | undefined): boolean {
  const norm = normalizeShop(shop)
  return norm === HQ_BARE
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
