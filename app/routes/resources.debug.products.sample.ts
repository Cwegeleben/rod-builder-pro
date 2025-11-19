import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'

// GET /resources/debug/products/sample?supplierId=batson-reel-seats&limit=20
// HQ-only: list a sample of canonical products for a supplier (title + sku + latest version presence)
export async function loader({ request }: LoaderFunctionArgs) {
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })

  const url = new URL(request.url)
  const supplierSlug = url.searchParams.get('supplierId') || 'batson-reel-seats'
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '20')))

  try {
    const supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
    if (!supplier) return json({ ok: true, supplierId: supplierSlug, items: [] })
    const rows = await prisma.$queryRawUnsafe<Array<{ sku: string; title: string; latestVersionId: string | null }>>(
      'SELECT p.sku AS sku, p.title AS title, p.latestVersionId AS latestVersionId FROM Product p WHERE p.supplierId = ?1 ORDER BY p.updatedAt DESC LIMIT ?2',
      supplier.id,
      limit,
    )
    const items = rows.map(r => ({ sku: r.sku, title: r.title, hasVersion: !!r.latestVersionId }))
    return json({ ok: true, supplierId: supplierSlug, count: items.length, items })
  } catch (e) {
    return json({ ok: false, supplierId: supplierSlug, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}

export const handle = { private: true }

export default function DebugProductsSample() {
  return null
}
