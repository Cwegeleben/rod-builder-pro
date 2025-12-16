import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadLatestActiveDesignBuildSummary } from '../lib/designStudio/builds.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = buildShopifyCorsHeaders(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ build: null }, { status: 403, headers })
  }

  try {
    const build = await loadLatestActiveDesignBuildSummary(access.shopDomain)
    return json({ build }, { headers })
  } catch (error) {
    console.error('[designStudio] Failed to load active build summary', error)
    return json({ build: null }, { status: 500, headers })
  }
}
