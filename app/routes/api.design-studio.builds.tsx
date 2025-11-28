import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { createDesignStorefrontBuild } from '../services/designStudio/storefrontBuild.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: buildShopifyCorsHeaders(request) })
  }
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ error: access.reason }, { status: 403, headers: buildShopifyCorsHeaders(request) })
  }

  const formData = await request.formData()
  const rawPayload = formData.get('payload')
  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return json({ error: 'INVALID_PAYLOAD' }, { status: 400, headers: buildShopifyCorsHeaders(request) })
  }

  let payload
  try {
    payload = JSON.parse(rawPayload)
  } catch {
    return json({ error: 'INVALID_JSON' }, { status: 400, headers: buildShopifyCorsHeaders(request) })
  }

  try {
    const result = await createDesignStorefrontBuild({ access, payload })
    return json(
      { ok: true, buildId: result.id, reference: result.reference },
      { headers: buildShopifyCorsHeaders(request) },
    )
  } catch (error) {
    console.error('[designStudio] Failed to create storefront build', error)
    return json(
      { ok: false, error: 'BUILD_CREATION_FAILED' },
      { status: 500, headers: buildShopifyCorsHeaders(request) },
    )
  }
}

export function loader({ request }: LoaderFunctionArgs) {
  return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: buildShopifyCorsHeaders(request) })
}
