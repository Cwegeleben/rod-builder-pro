import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadDesignStorefrontDraft, saveDesignStorefrontDraft } from '../services/designStudio/storefrontDraft.server'
import type { StorefrontBuildPayload } from '../services/designStudio/storefrontPayload.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = buildShopifyCorsHeaders(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ draft: null, token: null }, { status: 403, headers })
  }
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return json({ draft: null, token: null }, { headers })
  }
  try {
    const draft = await loadDesignStorefrontDraft({ access, token })
    return json({ draft, token: draft ? token : null }, { headers })
  } catch (error) {
    console.error('[designStudio] Failed to load storefront draft', error)
    return json({ draft: null, token: null }, { status: 500, headers })
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: buildShopifyCorsHeaders(request) })
  }
  const access = await getDesignStudioAccess(request)
  const headers = buildShopifyCorsHeaders(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ ok: false, token: null }, { status: 403, headers })
  }
  const formData = await request.formData()
  const rawPayload = formData.get('payload')
  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400, headers })
  }
  let payload: StorefrontBuildPayload
  try {
    payload = JSON.parse(rawPayload) as StorefrontBuildPayload
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, { status: 400, headers })
  }
  const tokenValue = formData.get('token')
  const token = typeof tokenValue === 'string' && tokenValue.trim() ? tokenValue.trim() : null
  try {
    const result = await saveDesignStorefrontDraft({ access, token, payload })
    return json({ ok: true, token: result.token }, { headers })
  } catch (error) {
    console.error('[designStudio] Failed to persist storefront draft', error)
    return json({ ok: false, error: 'DRAFT_SAVE_FAILED' }, { status: 500, headers })
  }
}
