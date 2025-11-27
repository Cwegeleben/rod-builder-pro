import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { createDesignStorefrontBuild } from '../services/designStudio/storefrontBuild.server'

const INVALID_METHOD = json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return INVALID_METHOD
  }
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ error: access.reason }, { status: 403 })
  }

  const formData = await request.formData()
  const rawPayload = formData.get('payload')
  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  let payload
  try {
    payload = JSON.parse(rawPayload)
  } catch {
    return json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  try {
    const result = await createDesignStorefrontBuild({ access, payload })
    return json({ ok: true, buildId: result.id, reference: result.reference })
  } catch (error) {
    console.error('[designStudio] Failed to create storefront build', error)
    return json({ ok: false, error: 'BUILD_CREATION_FAILED' }, { status: 500 })
  }
}

export const loader = () => INVALID_METHOD
