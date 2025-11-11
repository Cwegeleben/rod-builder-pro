import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { prisma } from '../db.server'
import { publishCanonicalProduct } from '../services/publishCanonical.server'

type BulkBody = { ids?: string[]; dryRun?: boolean }

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request)
  if (process.env.PRODUCT_DB_ENABLED !== '1') return json({ ok: false, error: 'disabled' }, { status: 400 })

  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, { status: 405 })
  let ids: string[] = []
  let dryRun = false
  try {
    const ct = request.headers.get('content-type') || ''
    if (!ct.includes('application/json')) throw new Error('content-type')
    const body = (await request.json()) as BulkBody
    ids = Array.isArray(body.ids) ? body.ids.filter((s): s is string => typeof s === 'string' && s.length > 0) : []
    dryRun = !!body.dryRun
  } catch {
    return json({ ok: false, error: 'bad body' }, { status: 400 })
  }
  if (ids.length === 0) return json({ ok: false, error: 'no ids' }, { status: 400 })
  if (ids.length > 100) return json({ ok: false, error: 'too many ids' }, { status: 400 })

  let created = 0
  let updated = 0
  let failed = 0
  let skipped = 0

  if (dryRun) {
    // Heuristic dry-run: created for DRAFT/READY, updated for PUBLISHED
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string | null }>>(
      `SELECT id, status FROM Product WHERE id IN (${placeholders})`,
      ...ids,
    )
    const statusById = new Map(rows.map(r => [r.id, r.status || 'DRAFT']))
    ids.forEach(id => {
      const s = statusById.get(id) || 'DRAFT'
      if (s === 'PUBLISHED') updated += 1
      else created += 1
    })
    return json({ ok: true, created, updated, failed, skipped })
  }

  for (const id of ids) {
    try {
      const res = await publishCanonicalProduct({ productId: id, dryRun: false })
      if (!res.ok) {
        failed += 1
      } else {
        created += res.created || 0
        updated += res.updated || 0
        skipped += res.failed ? 0 : 0
      }
    } catch {
      failed += 1
    }
  }

  return json({ ok: true, created, updated, failed, skipped })
}
