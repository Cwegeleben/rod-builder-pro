import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'

// GET /resources/debug/ps/count?supplierId=<slug>&limit=5
// HQ-only: raw SQL ProductSource count + sample, resilient to older schemas
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const supplierSlug = url.searchParams.get('supplierId') || 'batson-reel-seats'
  const limit = Math.min(Number(url.searchParams.get('limit') || '5') || 5, 50)
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })

  try {
    const supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
    if (!supplier)
      return json({
        ok: true,
        supplierId: supplierSlug,
        count: 0,
        mapped: 0,
        sample: [],
        mappedSample: [],
        unknownSample: [],
      })

    const toNum = (v: unknown) => {
      if (typeof v === 'bigint') return Number(v)
      const n = Number(v as number)
      return Number.isFinite(n) ? n : 0
    }

    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
      'SELECT COUNT(*) as count FROM ProductSource WHERE supplierId = ?1',
      supplier.id,
    )
    const mappedRows = await prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
      'SELECT COUNT(*) as count FROM ProductSource WHERE supplierId = ?1 AND productId IS NOT NULL',
      supplier.id,
    )
    const count = toNum(totalRows?.[0]?.count)
    const mapped = toNum(mappedRows?.[0]?.count)

    const sample = await prisma.$queryRawUnsafe<Array<{ url: string }>>(
      'SELECT url FROM ProductSource WHERE supplierId = ?1 ORDER BY lastSeenAt DESC LIMIT ?2',
      supplier.id,
      limit,
    )
    const mappedSample = await prisma.$queryRawUnsafe<Array<{ url: string }>>(
      'SELECT url FROM ProductSource WHERE supplierId = ?1 AND productId IS NOT NULL ORDER BY lastSeenAt DESC LIMIT ?2',
      supplier.id,
      limit,
    )
    const unknownSample = await prisma.$queryRawUnsafe<Array<{ url: string }>>(
      'SELECT url FROM ProductSource WHERE supplierId = ?1 AND productId IS NULL ORDER BY lastSeenAt DESC LIMIT ?2',
      supplier.id,
      limit,
    )
    return json({ ok: true, supplierId: supplierSlug, count, mapped, sample, mappedSample, unknownSample })
  } catch (e) {
    return json({ ok: false, supplierId: supplierSlug, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}

export const handle = { private: true }

export default function DebugPsCount() {
  return null
}
