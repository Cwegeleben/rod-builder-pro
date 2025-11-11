import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { prisma } from '../db.server'
import { publishCanonicalProduct } from '../services/publishCanonical.server'

// Minimal canonical publish handler (dry-run): computes totals based on Product and latest ProductVersion
// Future: call real Shopify publish pipeline with mapped fields
export async function action({ request, params }: ActionFunctionArgs) {
  await authenticate.admin(request)
  const { id } = params
  if (!id) return json({ ok: false, error: 'missing id' }, { status: 400 })
  if (process.env.PRODUCT_DB_ENABLED !== '1') return json({ ok: false, error: 'disabled' }, { status: 400 })

  try {
    // Optional: allow real publish when client sends { dryRun: false } JSON body
    let dryRun = true
    try {
      if (request.method === 'POST') {
        const ct = request.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const body = await request.json()
          if (typeof body?.dryRun === 'boolean') dryRun = body.dryRun
        }
      }
    } catch {
      // ignore body parse issues and default to dryRun
    }

    if (!dryRun) {
      const res = await publishCanonicalProduct({ productId: id, dryRun: false })
      if (!res.ok) return json({ ok: false, error: res.error }, { status: 500 })
      return json({ ok: true, created: res.created, updated: res.updated, failed: res.failed, shop: res.shopDomain })
    }

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; sku: string; latestVersionId: string | null; status: string | null }>
    >('SELECT id, sku, latestVersionId, status FROM Product WHERE id = ? LIMIT 1', id)
    if (!rows || rows.length === 0) return json({ ok: false, error: 'not found' }, { status: 404 })
    const p = rows[0]
    // For now, just return a dry-run totals snapshot: created if DRAFT/READY, updated if PUBLISHED
    const created = p.status === 'DRAFT' || p.status === 'READY' ? 1 : 0
    const updated = p.status === 'PUBLISHED' ? 1 : 0
    const failed = 0
    return json({ ok: true, created, updated, failed })
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'publish failed' }, { status: 500 })
  }
}
