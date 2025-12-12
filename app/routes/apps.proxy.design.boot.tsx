import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const isThemeRequest = url.searchParams.get('rbp_theme') === '1'
  const themeSectionId = url.searchParams.get('rbp_theme_section') ?? null
  const access = await getDesignStudioAccess(request)
  const draftStorageKey = access.shopDomain ? `ds-draft:${access.shopDomain}` : null

  const payload = {
    access: {
      enabled: access.enabled,
      reason: access.reason,
      tier: access.tier,
      shopDomain: access.shopDomain,
    },
    requestContext: {
      source: isThemeRequest ? 'theme-extension' : 'app-proxy',
      themeSectionId,
    },
    draft: {
      storageKey: draftStorageKey,
    },
    meta: {
      generatedAt: new Date().toISOString(),
    },
  }

  return json(payload, {
    headers: buildShopifyCorsHeaders(request, {
      'Cache-Control': 'no-store, must-revalidate',
    }),
  })
}
