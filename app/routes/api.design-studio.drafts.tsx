import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadDesignStorefrontDraft, saveDesignStorefrontDraft } from '../services/designStudio/storefrontDraft.server'
import type { StorefrontBuildPayload } from '../services/designStudio/storefrontPayload.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

// <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 -->
// Manual sanity checklist (Phase C wiring):
// 1) Load Design Studio as a tenant user and confirm the builder renders.
// 2) Create a new draft, make a few changes, and see autosave confirm.
// 3) Refresh the page and ensure the selections + validation state restore from the draft.
// 4) Trigger an incompatible selection to confirm compat toasts and badges still surface.
// 5) Inspect the database to verify a DesignBuild + DesignBuildDraft pair exists and DesignBuild.latestDraftId points to the newest draft.
// <!-- END RBP GENERATED: design-studio-phase-c-v1 -->

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = buildShopifyCorsHeaders(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ draft: null, token: null }, { status: 403, headers })
  }
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  console.log('[designStudio] drafts loader', {
    shop: access.shopDomain,
    token,
  })
  if (!token) {
    return json({ draft: null, token: null }, { headers })
  }
  try {
    // <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 -->
    const { draft, token: nextToken } = await loadDesignStorefrontDraft({ access, token })
    return json({ draft, token: draft ? nextToken : null }, { headers })
    // <!-- END RBP GENERATED: design-studio-phase-c-v1 -->
  } catch (error) {
    console.error('[designStudio] Failed to load storefront draft', error)
    return json({ draft: null, token: null }, { status: 500, headers })
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const method = request.method.toUpperCase()
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: buildShopifyCorsHeaders(request) })
  }
  const access = await getDesignStudioAccess(request)
  const headers = buildShopifyCorsHeaders(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ ok: false, token: null }, { status: 403, headers })
  }
  const formData = await request.formData()
  const rawPayload = formData.get('payload')
  console.log('[designStudio] drafts action', {
    shop: access.shopDomain,
    method,
    hasPayload: typeof rawPayload === 'string',
  })
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
  if ((method === 'PUT' || method === 'PATCH') && !token) {
    return json({ ok: false, error: 'TOKEN_REQUIRED' }, { status: 400, headers })
  }
  try {
    const result = await saveDesignStorefrontDraft({ access, token, payload })
    return json({ ok: true, token: result.token }, { headers })
  } catch (error) {
    console.error('[designStudio] Failed to persist storefront draft', error)
    return json({ ok: false, error: 'DRAFT_SAVE_FAILED' }, { status: 500, headers })
  }
}
