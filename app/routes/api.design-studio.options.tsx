import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { parseCompatibilityContext } from '../lib/designStudio/compatibility'
import { isDesignStorefrontPartRole, loadDesignStorefrontOptions } from '../lib/designStudio/storefront.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const access = await getDesignStudioAccess(request)
  if (!access.enabled) {
    return json({ error: access.reason }, { status: 403, headers: buildShopifyCorsHeaders(request) })
  }

  const url = new URL(request.url)
  const roleParam = url.searchParams.get('role')
  if (!roleParam || !isDesignStorefrontPartRole(roleParam)) {
    return json({ options: [], issues: [] }, { status: 400, headers: buildShopifyCorsHeaders(request) })
  }

  const takeParam = url.searchParams.get('take')
  const take = takeParam ? clampTake(Number(takeParam)) : undefined
  const compatibilityContext = parseCompatibilityContext(url.searchParams.get('compat'))

  try {
    const { options, issues } = await loadDesignStorefrontOptions({
      access,
      role: roleParam,
      take,
      compatibilityContext,
    })
    return json({ options, issues }, { headers: buildShopifyCorsHeaders(request) })
  } catch (error) {
    console.error('[designStudio] Failed to load options', error)
    return json({ options: [], issues: [] }, { status: 500, headers: buildShopifyCorsHeaders(request) })
  }
}

function clampTake(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined
  return Math.max(1, Math.min(60, Math.floor(value)))
}
