import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getAdminClient } from '../services/shopifyAdmin.server'
import { getBatsonDefinitionReport } from '../services/shopifyMetafields.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const target = url.searchParams.get('target') || ''
  if (target !== 'batson-rod-blanks') return json({ error: 'Unsupported target' }, { status: 400 })
  try {
    // Prefer canonical myshopify.com domain if available
    const shop = process.env.SHOP || process.env.SHOP_CUSTOM_DOMAIN || ''
    if (!shop) throw new Error('SHOP not configured')
    const { accessToken, shopName } = await getAdminClient(shop)
    const report = await getBatsonDefinitionReport(shopName, accessToken)
    return json({ report })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to load metafield report'
    return json({ error: message }, { status: 500 })
  }
}
