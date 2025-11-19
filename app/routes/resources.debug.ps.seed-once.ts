import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'

// GET /resources/debug/ps/seed-once?supplierId=<slug>&url=<url>
// HQ-only: upsert a single ProductSource row via raw SQL, then return count
export async function loader({ request }: LoaderFunctionArgs) {
  const urlObj = new URL(request.url)
  const supplierSlug = urlObj.searchParams.get('supplierId') || 'batson-reel-seats'
  const seedUrl = (urlObj.searchParams.get('url') || '').trim()
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })
  if (!seedUrl) return json({ error: 'url required' }, { status: 400 })

  try {
    let supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
    if (!supplier) {
      const id = (await import('node:crypto')).randomUUID()
      await prisma.$executeRawUnsafe(
        'INSERT INTO Supplier (id, slug, name, active, createdAt, updatedAt) VALUES (?1, ?2, ?3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        id,
        supplierSlug,
        supplierSlug,
      )
      supplier = { id } as unknown as typeof supplier
    }
    const supplierId = supplier!.id
    const id = (await import('node:crypto')).randomUUID()
    // Try update by (supplierId, url); if no row changed, insert
    const upd = await prisma.$executeRawUnsafe(
      'UPDATE ProductSource SET lastSeenAt = CURRENT_TIMESTAMP, source = ?1 WHERE supplierId = ?2 AND url = ?3',
      'forced',
      supplierId,
      seedUrl,
    )
    if ((upd as unknown as { changes?: number })?.changes === 0) {
      try {
        await prisma.$executeRawUnsafe(
          'INSERT INTO ProductSource (id, supplierId, url, source, notes, firstSeenAt, lastSeenAt) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          id,
          supplierId,
          seedUrl,
          'forced',
          'debug:seed-once',
        )
      } catch {
        // ignore
      }
    }
    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM ProductSource WHERE supplierId = ?1',
      supplierId,
    )
    const count = countRows?.[0]?.count ?? 0
    return json({ ok: true, supplierId: supplierSlug, count })
  } catch (e) {
    return json({ ok: false, supplierId: supplierSlug, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}

export const handle = { private: true }

export default function DebugPsSeedOnce() {
  return null
}
