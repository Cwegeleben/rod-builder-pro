import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'

// GET /resources/debug/ps/logs?supplierId=<slug>&limit=50
// HQ-only: tail DebugSeedLog entries
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const supplierSlug = url.searchParams.get('supplierId') || ''
  const limit = Math.min(Number(url.searchParams.get('limit') || '50') || 50, 200)
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })

  try {
    let supplierId: string | null = null
    if (supplierSlug) {
      const s = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
      supplierId = s?.id || null
    }
    // Raw SQL because this table is debug-only and not in Prisma schema
    let rows: Array<{ at: string; supplierKey: string | null; url: string; path: string; note: string }>
    if (supplierId) {
      rows = await prisma.$queryRawUnsafe(
        'SELECT at, supplierKey, url, path, note FROM DebugSeedLog WHERE supplierKey = ?1 ORDER BY at DESC LIMIT ?2',
        supplierId,
        limit,
      )
    } else {
      rows = await prisma.$queryRawUnsafe(
        'SELECT at, supplierKey, url, path, note FROM DebugSeedLog ORDER BY at DESC LIMIT ?1',
        limit,
      )
    }
    return json({ ok: true, supplierId: supplierSlug || undefined, limit, rows })
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}

export default function DebugPsLogs() {
  return null
}
