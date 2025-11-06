/* HQ-only: Lookup a Shopify product by handle and return productId/status/webUrl */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import Shopify from 'shopify-api-node'
import { prisma } from '../db.server'
import { getShopAccessToken } from '../services/shopifyAdmin.server'
import { requireHqShopOr404 } from '../lib/access.server'
import { authenticate } from '../shopify.server'

function mkProductUrl(shop: string, handle: string): string | null {
  if (!shop || !handle) return null
  const domain = shop.replace(/^https?:\/\//, '')
  return `https://${domain}/products/${handle}`
}

async function getShopDomainFromRequest(request: Request): Promise<string | null> {
  // Prefer the installed shop from the current admin session
  try {
    const { session } = await authenticate.admin(request)
    const s = (session as unknown as { shop?: string }).shop
    if (s) return s
  } catch {
    // ignore
  }
  // Fallback to env override or first offline session
  let shopDomain = process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
  if (!shopDomain) {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    if (sess?.shop) shopDomain = sess.shop
  }
  return shopDomain || null
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const handle = url.searchParams.get('handle') || ''
  if (!handle) return json({ ok: false, error: 'Missing handle' }, { status: 400 })

  const shop = await getShopDomainFromRequest(request)
  if (!shop) return json({ ok: false, error: 'No shop domain configured' }, { status: 500 })
  const accessToken = await getShopAccessToken(shop)
  const shopify = new Shopify({ shopName: shop, accessToken, apiVersion: '2024-10' })

  try {
    const list = (await shopify.product.list({ handle })) as any[]
    const product = Array.isArray(list) && list.length ? list[0] : null
    if (!product) return json({ ok: true, found: false, handle })
    return json({
      ok: true,
      found: true,
      handle,
      productId: Number(product.id),
      status: product.status || null,
      webUrl: mkProductUrl(shop, handle),
    })
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}

export default function ToolsLookupProductApi() {
  return null
}
