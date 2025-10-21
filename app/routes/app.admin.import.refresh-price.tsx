import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import { runPriceAvailabilityRefresh } from '../../packages/importer/src/jobs/priceAvail'

// POST /app/admin/import/refresh-price
// Triggers a price/availability refresh for a supplier (default 'batson').
// Auth: HQ-gated by default; alternatively allow token via Authorization: Bearer <PRICE_REFRESH_TOKEN> for external cron.
export const action = async ({ request }: ActionFunctionArgs) => {
  const method = request.method.toUpperCase()
  if (method !== 'POST') return json({ ok: false, error: 'Method Not Allowed' }, { status: 405 })

  // Optional token auth for external cron
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const allowToken = process.env.PRICE_REFRESH_TOKEN && token === process.env.PRICE_REFRESH_TOKEN
  if (!allowToken) {
    // Fall back to HQ gate when token is not provided/mismatched
    await requireHQAccess(request)
  }

  let supplierId = 'batson'
  try {
    if (/application\/json/i.test(request.headers.get('content-type') || '')) {
      const body = (await request.json().catch(() => ({}))) as Partial<{ supplierId: string }>
      if (body.supplierId) supplierId = String(body.supplierId)
    } else {
      const fd = await request.formData().catch(() => null)
      const s = fd?.get('supplierId')?.toString()
      if (s) supplierId = s
    }
  } catch {
    // ignore parse issues
  }

  try {
    await runPriceAvailabilityRefresh(supplierId)
    return json({ ok: true, supplierId })
  } catch (e) {
    const err = e as { message?: string }
    return json({ ok: false, error: err?.message || 'Refresh failed' }, { status: 500 })
  }
}

export default function RefreshPriceRoute() {
  return null
}
