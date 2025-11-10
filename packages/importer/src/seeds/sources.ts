// <!-- BEGIN RBP GENERATED: importer-seeds-v1 -->
import { prisma } from '../../../../app/db.server'
import { normalizeUrl } from '../lib/url'

export async function upsertProductSource(
  supplierId: string,
  url: string,
  source: 'manual' | 'discovered' | 'forced',
  notes?: string,
  templateId?: string,
) {
  const n = normalizeUrl(url)
  if (!n) return null
  // Use dynamic access to avoid compile-time coupling to generated client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const whereKey: Record<string, unknown> = {
    product_source_supplier_template_url_unique: { supplierId, templateId: templateId || null, url: n },
  }
  await db.productSource
    .upsert({
      where: whereKey as never,
      update: { lastSeenAt: new Date(), source },
      create: { supplierId, templateId: templateId || null, url: n, source, notes },
    })
    .catch(async () => {
      // Fallback to legacy unique (without templateId) during rolling migration
      try {
        await db.productSource.upsert({
          where: { product_source_supplier_template_url_unique: { supplierId, templateId: null, url: n } },
          update: { lastSeenAt: new Date(), source },
          create: { supplierId, templateId: null, url: n, source, notes },
        })
      } catch {
        // Final fallback: ignore
      }
    })
  return n
}

export async function linkExternalIdForSource(
  supplierId: string,
  url: string,
  externalId: string,
  templateId?: string,
) {
  const n = normalizeUrl(url)
  if (!n) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.productSource
    .update({
      where: { product_source_supplier_template_url_unique: { supplierId, templateId: templateId || null, url: n } },
      data: { externalId, lastSeenAt: new Date() },
    })
    .catch(() => {})
}

export async function fetchActiveSources(supplierId: string, templateId?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const where = templateId ? { supplierId, templateId } : { supplierId, templateId: null }
  return db.productSource.findMany({ where })
}
// <!-- END RBP GENERATED: importer-seeds-v1 -->
