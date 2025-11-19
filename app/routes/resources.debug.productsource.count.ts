import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'

// GET /resources/debug/productsource/count?supplierId=<slug>&limit=5
// HQ-only lightweight diagnostic: returns ProductSource count and a small sample of urls for a supplier slug.
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const supplierSlug = url.searchParams.get('supplierId') || 'batson-reel-seats'
  const limit = Math.min(Number(url.searchParams.get('limit') || '5') || 5, 50)
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })

  try {
    const supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
    if (!supplier) return json({ ok: true, supplierId: supplierSlug, count: 0, sample: [] })
    // Use raw SQL to avoid selecting columns that may not exist in older DBs
    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM ProductSource WHERE supplierId = ?1',
      supplier.id,
    )
    const count = countRows?.[0]?.count ?? 0
    const sample = await prisma.$queryRawUnsafe<Array<{ url: string; lastSeenAt: string; source: string }>>(
      'SELECT url, lastSeenAt, source FROM ProductSource WHERE supplierId = ?1 ORDER BY lastSeenAt DESC LIMIT ?2',
      supplier.id,
      limit,
    )
    return json({ ok: true, supplierId: supplierSlug, count, sample })
  } catch (e) {
    return json({ ok: false, supplierId: supplierSlug, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}

export const handle = { private: true }
