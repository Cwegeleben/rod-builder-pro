// <!-- BEGIN RBP GENERATED: importer-seeds-v1 -->
import { prisma } from '../../../../app/db.server'
import { normalizeUrl } from '../lib/url'

let __seedLogInit = false
async function logSeedDebug(note: string, path: string, supplierKey: string, url: string) {
  try {
    if (!__seedLogInit) {
      __seedLogInit = true
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS DebugSeedLog (id TEXT PRIMARY KEY NOT NULL, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, supplierKey TEXT, url TEXT, path TEXT, note TEXT)',
      )
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS DebugSeedLog_at_idx ON DebugSeedLog(at)')
    }
    const id = (await import('node:crypto')).randomUUID()
    await prisma.$executeRawUnsafe(
      'INSERT INTO DebugSeedLog (id, supplierKey, url, path, note) VALUES (?1, ?2, ?3, ?4, ?5)',
      id,
      supplierKey,
      url,
      path,
      note,
    )
  } catch {
    // ignore logging errors
  }
}

async function resolveSupplierIdMaybe(slugOrId: string): Promise<string> {
  // Accept either a canonical Supplier.id or a slug; resolve to id.
  // Also tolerate existing deployments where callers passed a slug.
  const s = (slugOrId || '').trim()
  if (!s) return s
  try {
    // Try by id first
    const byId = await prisma.supplier.findUnique({ where: { id: s } })
    if (byId) return byId.id
  } catch {
    /* ignore */
  }
  try {
    const bySlug = await prisma.supplier.findFirst({ where: { slug: s } })
    if (bySlug) return bySlug.id
  } catch {
    /* ignore */
  }
  // Best-effort auto-create to unblock diagnostics and seeding
  try {
    const id = (await import('node:crypto')).randomUUID()
    const name =
      s
        .split(/[-_\s]+/)
        .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
        .join(' ')
        .trim() || s
    await prisma.$executeRawUnsafe(
      'INSERT INTO Supplier (id, slug, name, active, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      id,
      s,
      name,
    )
    return id
  } catch {
    return s // fall back; legacy schemas without FK will still accept the slug
  }
}

export async function upsertProductSource(
  supplierId: string,
  url: string,
  source: 'manual' | 'discovered' | 'forced',
  notes?: string,
  templateId?: string,
) {
  const n = normalizeUrl(url)
  if (!n) return null
  const supplierKey = await resolveSupplierIdMaybe(supplierId)
  await logSeedDebug('attempt', 'start', supplierKey, n)
  // Use dynamic access to avoid compile-time coupling to generated client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const whereKey: Record<string, unknown> = {
    product_source_supplier_template_url_unique: { supplierId: supplierKey, templateId: templateId || null, url: n },
  }
  await db.productSource
    .upsert({
      where: whereKey as never,
      update: { lastSeenAt: new Date(), source },
      create: { supplierId: supplierKey, templateId: templateId || null, url: n, source, notes },
    })
    .then(async () => {
      await logSeedDebug('success', 'primary', supplierKey, n)
    })
    .catch(async () => {
      // Fallback path for older schemas without templateId or different uniques
      try {
        const upd = await db.productSource.updateMany({
          where: { supplierId: supplierKey, url: n },
          data: { lastSeenAt: new Date(), source },
        })
        if ((upd?.count || 0) === 0) {
          // Ensure we always provide an id in case the older schema lacks a default for id
          const id = (await import('node:crypto')).randomUUID()
          // Try insert with templateId (nullable) first; if it fails, fall back to schema without templateId
          try {
            await prisma.$executeRawUnsafe(
              'INSERT INTO ProductSource (id, supplierId, templateId, url, source, notes, firstSeenAt, lastSeenAt) VALUES (?1, ?2, NULL, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
              id,
              supplierKey,
              n,
              source,
              notes || null,
            )
            await logSeedDebug('success', 'rawInsert:withTemplate', supplierKey, n)
          } catch {
            try {
              await prisma.$executeRawUnsafe(
                'INSERT INTO ProductSource (id, supplierId, url, source, notes, firstSeenAt, lastSeenAt) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                id,
                supplierKey,
                n,
                source,
                notes || null,
              )
              await logSeedDebug('success', 'rawInsert:legacy', supplierKey, n)
            } catch {
              // ignore final failure
            }
          }
        } else {
          await logSeedDebug('success', 'updateMany', supplierKey, n)
        }
      } catch {
        await logSeedDebug('error', 'fallback', supplierKey, n)
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
  const supplierKey = await resolveSupplierIdMaybe(supplierId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.productSource
    .update({
      where: {
        product_source_supplier_template_url_unique: {
          supplierId: supplierKey,
          templateId: templateId || null,
          url: n,
        },
      },
      data: { externalId, lastSeenAt: new Date() },
    })
    .catch(async () => {
      // Fallback for older schemas without templateId unique
      try {
        await db.productSource.updateMany({
          where: { supplierId: supplierKey, url: n },
          data: { externalId, lastSeenAt: new Date() },
        })
        await logSeedDebug('link:success', 'updateMany', supplierKey, n)
      } catch {
        await logSeedDebug('link:error', 'fallback', supplierKey, n)
      }
    })
}

export async function fetchActiveSources(supplierId: string, templateId?: string) {
  const supplierKey = await resolveSupplierIdMaybe(supplierId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  // Prefer partitioned query by templateId when available; fall back to legacy schema without templateId
  try {
    const where = templateId ? { supplierId: supplierKey, templateId } : { supplierId: supplierKey, templateId: null }
    return await db.productSource.findMany({ where })
  } catch {
    // Legacy fallback: environments without templateId column
    try {
      return await db.productSource.findMany({ where: { supplierId: supplierKey } })
    } catch {
      return []
    }
  }
}
// <!-- END RBP GENERATED: importer-seeds-v1 -->
