import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadDesignStorefrontConfig } from '../lib/designStudio/storefront.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const access = await getDesignStudioAccess(request)
  if (!access.enabled) {
    return json(
      { access: { enabled: false, reason: access.reason, shopDomain: access.shopDomain } },
      {
        status: 200,
        headers: buildShopifyCorsHeaders(request, { 'Cache-Control': 'no-store, must-revalidate' }),
      },
    )
  }

  try {
    const config = await loadDesignStorefrontConfig(access)
    return json(
      { config, access: { enabled: true, tier: access.tier, shopDomain: access.shopDomain } },
      {
        headers: buildShopifyCorsHeaders(request, { 'Cache-Control': 'no-store, must-revalidate' }),
      },
    )
  } catch (error) {
    console.error('[designStudio] storefront config proxy failed', error)
    return json(
      { error: 'CONFIG_UNAVAILABLE' },
      {
        status: 500,
        headers: buildShopifyCorsHeaders(request, { 'Cache-Control': 'no-store, must-revalidate' }),
      },
    )
  }
}
