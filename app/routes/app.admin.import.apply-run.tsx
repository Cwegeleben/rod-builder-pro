// redirect shim only; do not expand.
// <!-- BEGIN RBP GENERATED: gateway-token-bridge-v1 -->
import { json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import { applyImportRunToShop } from '../services/importer/applyRun.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireHQAccess(request)

  let runId: string | undefined
  let shop: string | undefined
  let approvedOnly = false
  let deleteOverride = false
  const ctype = request.headers.get('content-type') || ''
  if (/application\/json/i.test(ctype)) {
    const body = (await request.json().catch(() => ({}))) as Partial<{
      runId: string
      shop: string
      approvedOnly?: boolean
      deleteOverride?: boolean
    }>
    runId = body.runId
    shop = body.shop
    approvedOnly = Boolean(body.approvedOnly)
    deleteOverride = Boolean(body.deleteOverride)
  } else {
    const fd = await request.formData().catch(() => null)
    runId = fd?.get('runId')?.toString()
    shop = fd?.get('shop')?.toString()
    approvedOnly = fd?.get('approvedOnly') != null
    deleteOverride = fd?.get('deleteOverride') != null
  }
  if (!runId || !shop) {
    return json({ ok: false, error: 'Missing runId or shop' }, { status: 400 })
  }

  try {
    const result = await applyImportRunToShop({ runId, shopDomain: shop, approvedOnly, deleteOverride })
    return json(
      { ok: true, runId: result.runId, shopDomain: result.shopDomain, results: result.results },
      { status: 200 },
    )
  } catch (e) {
    const err = e as { message?: string; status?: number }
    const msg = err?.message || 'Apply run failed'
    const status = typeof err?.status === 'number' ? err.status : 500
    return json({ ok: false, error: msg }, { status })
  }
}

export default function ApplyRunRoute() {
  return null
}
// <!-- END RBP GENERATED: gateway-token-bridge-v1 -->
