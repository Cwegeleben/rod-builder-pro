// <!-- BEGIN RBP GENERATED: importer-seeds-v1 -->
import { prisma } from '../../../../app/db.server'
import { normalizeUrl } from '../lib/url'

export async function upsertProductSource(
  supplierId: string,
  url: string,
  source: 'manual' | 'discovered' | 'forced',
  notes?: string,
) {
  const n = normalizeUrl(url)
  if (!n) return null
  // Use dynamic access to avoid compile-time coupling to generated client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.productSource.upsert({
    where: { product_source_supplier_url_unique: { supplierId, url: n } },
    update: { lastSeenAt: new Date(), source },
    create: { supplierId, url: n, source, notes },
  })
  return n
}

export async function linkExternalIdForSource(supplierId: string, url: string, externalId: string) {
  const n = normalizeUrl(url)
  if (!n) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.productSource
    .update({
      where: { product_source_supplier_url_unique: { supplierId, url: n } },
      data: { externalId, lastSeenAt: new Date() },
    })
    .catch(() => {})
}

export async function fetchActiveSources(supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  return db.productSource.findMany({ where: { supplierId } })
}
// <!-- END RBP GENERATED: importer-seeds-v1 -->
