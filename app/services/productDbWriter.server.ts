import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.server'
import { deriveDesignStudioAnnotations, type DesignStudioAnnotation } from '../lib/designStudio/annotations.server'
import { recordDesignStudioAudit } from '../lib/designStudio/audit.server'

export interface NormalizedProductInput {
  supplier: { id?: string; slug?: string; name?: string; urlRoot?: string }
  sku: string
  title: string
  type?: string | null
  description?: string | null
  images?: Prisma.InputJsonValue | null
  rawSpecs?: Prisma.InputJsonValue | null
  normSpecs?: Prisma.InputJsonValue | null
  priceMsrp?: number | null
  priceWholesale?: number | null
  availability?: string | null
  sources?: Array<{ url: string; externalId?: string | null; source?: string | null; notes?: string | null }> | null
  fetchedAt?: Date | string
  designStudio?: DesignStudioAnnotation
}

export type UpsertResult = {
  supplierId: string
  productId: string
  versionId: string
  createdProduct: boolean
  createdVersion: boolean
  contentHash: string
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  const replacer = (_key: string, val: unknown): unknown => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>
      if (seen.has(obj)) return undefined
      seen.add(obj)
      if (!Array.isArray(obj)) {
        const out: Record<string, unknown> = {}
        for (const k of Object.keys(obj).sort()) out[k] = obj[k]
        return out
      }
    }
    return val
  }
  return JSON.stringify(value, replacer)
}

function jsonValueToRecord(value: Prisma.InputJsonValue | null | undefined): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function resolvePartTypeFromInput(
  input: NormalizedProductInput,
  raw: Record<string, unknown> | undefined,
  norm: Record<string, unknown> | undefined,
): string | undefined {
  const candidate =
    (norm?.partType as string | undefined) ??
    (norm?.part_type as string | undefined) ??
    (raw?.partType as string | undefined) ??
    (raw?.part_type as string | undefined) ??
    input.type ??
    undefined
  return typeof candidate === 'string' ? candidate : undefined
}

function withDesignStudio(
  input: NormalizedProductInput,
): NormalizedProductInput & { designStudio: DesignStudioAnnotation } {
  if (input.designStudio) return input as NormalizedProductInput & { designStudio: DesignStudioAnnotation }
  const raw = jsonValueToRecord(input.rawSpecs)
  const norm = jsonValueToRecord(input.normSpecs)
  const partType = resolvePartTypeFromInput(input, raw, norm)
  const designStudio = deriveDesignStudioAnnotations({
    supplierKey: input.supplier.slug || input.supplier.id || input.supplier.name || input.sku,
    partType,
    title: input.title,
    rawSpecs: raw,
    normSpecs: norm,
  })
  return { ...input, designStudio }
}

export function computeContentHash(input: NormalizedProductInput): string {
  const enriched = withDesignStudio(input)
  const payload = {
    title: input.title,
    type: input.type ?? null,
    description: input.description ?? null,
    images: input.images ?? null,
    normSpecs: input.normSpecs ?? null,
    priceMsrp: input.priceMsrp ?? null,
    priceWholesale: input.priceWholesale ?? null,
    availability: input.availability ?? null,
    designStudio: enriched.designStudio,
  }
  const str = stableStringify(payload)
  return crypto.createHash('sha256').update(str).digest('hex')
}

export async function upsertNormalizedProduct(input: NormalizedProductInput): Promise<UpsertResult> {
  const enrichedInput = withDesignStudio(input)
  const supplierId = await ensureSupplier(enrichedInput.supplier)
  const contentHash = computeContentHash(enrichedInput)
  const ds = enrichedInput.designStudio

  // Find product by (supplierId, sku)
  const prodRows = await prisma.$queryRawUnsafe<Array<{ id: string; latestVersionId: string | null }>>(
    'SELECT id, latestVersionId FROM Product WHERE supplierId = ? AND sku = ? LIMIT 1',
    supplierId,
    input.sku,
  )
  let productId: string
  let createdProduct = false
  if (prodRows && prodRows.length) {
    productId = prodRows[0].id
    // latestVersionId available via prodRows[0].latestVersionId if needed in future
    // Update title/type best-effort
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE Product
         SET title = ?,
             type = ?,
             designStudioReady = ?,
             designStudioFamily = ?,
             designStudioCoverageNotes = ?,
             designStudioLastTouchedAt = CURRENT_TIMESTAMP,
             updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        input.title,
        input.type ?? null,
        ds.ready ? 1 : 0,
        ds.family ?? null,
        ds.coverageNotes ?? null,
        productId,
      )
    } catch {
      /* ignore */
    }
  } else {
    createdProduct = true
    productId = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO Product (
         id, supplierId, sku, title, type, status,
         designStudioReady, designStudioFamily, designStudioLastTouchedAt, designStudioCoverageNotes,
         createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      productId,
      supplierId,
      input.sku,
      input.title,
      input.type ?? null,
      'READY',
      ds.ready ? 1 : 0,
      ds.family ?? null,
      ds.coverageNotes ?? null,
    )
  }

  // If a version with same contentHash already exists, reuse it
  const verExisting = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    'SELECT id FROM ProductVersion WHERE productId = ? AND contentHash = ? LIMIT 1',
    productId,
    contentHash,
  )
  if (verExisting && verExisting.length) {
    const versionId = verExisting[0].id
    await upsertSourcesLinks(supplierId, productId, input.sources)
    await recordDesignStudioAudit({ productId, productVersionId: versionId, ds })
    return {
      supplierId,
      productId,
      versionId,
      createdProduct,
      createdVersion: false,
      contentHash,
    }
  }

  // Else, create a new version
  const versionId = crypto.randomUUID()
  const fetchedAt = input.fetchedAt ? new Date(input.fetchedAt) : new Date()
  const toJson = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v))
  await prisma.$executeRawUnsafe(
    `INSERT INTO ProductVersion (
        id, productId, contentHash, rawSpecs, normSpecs, description, images,
        priceMsrp, priceWholesale, availability, sourceSnapshot, fetchedAt, createdAt,
        designStudioRole, designStudioSeries, designStudioCompatibility, designStudioSourceQuality, designStudioHash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
    versionId,
    productId,
    contentHash,
    toJson(input.rawSpecs ?? null),
    toJson(input.normSpecs ?? null),
    input.description ?? null,
    toJson(input.images ?? null),
    input.priceMsrp ?? null,
    input.priceWholesale ?? null,
    input.availability ?? null,
    toJson(input.sources ?? null),
    fetchedAt.toISOString(),
    ds.role ?? null,
    ds.series ?? null,
    toJson(ds.compatibility),
    ds.sourceQuality ?? null,
    ds.hash,
  )

  // Point product.latestVersionId to the new version
  try {
    await prisma.$executeRawUnsafe(
      'UPDATE Product SET latestVersionId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      versionId,
      productId,
    )
  } catch {
    /* ignore */
  }

  await upsertSourcesLinks(supplierId, productId, input.sources)
  await recordDesignStudioAudit({ productId, productVersionId: versionId, ds })
  return { supplierId, productId, versionId, createdProduct, createdVersion: true, contentHash }
}

async function upsertSourcesLinks(supplierId: string, productId: string, sources: NormalizedProductInput['sources']) {
  if (!Array.isArray(sources) || sources.length === 0) return
  for (const s of sources) {
    try {
      // Try find existing by (supplierId, url, templateId IS NULL)
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM ProductSource WHERE supplierId = ? AND url = ? AND templateId IS NULL LIMIT 1',
        supplierId,
        s.url,
      )
      if (rows && rows.length) {
        await prisma.$executeRawUnsafe(
          'UPDATE ProductSource SET externalId = ?, source = ?, notes = ?, productId = ?, lastSeenAt = CURRENT_TIMESTAMP WHERE id = ?',
          s.externalId ?? null,
          s.source ?? 'discovered',
          s.notes ?? null,
          productId,
          rows[0].id,
        )
      } else {
        const id = crypto.randomUUID()
        await prisma.$executeRawUnsafe(
          'INSERT INTO ProductSource (id, supplierId, templateId, url, externalId, source, notes, productId, firstSeenAt, lastSeenAt) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          id,
          supplierId,
          s.url,
          s.externalId ?? null,
          s.source ?? 'discovered',
          s.notes ?? null,
          productId,
        )
      }
    } catch {
      // ignore duplicates or race conditions
    }
  }
}

async function ensureSupplier(s: NormalizedProductInput['supplier']): Promise<string> {
  const slugify = (val: string) =>
    val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60)

  if (s.id) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM Supplier WHERE id = ? LIMIT 1',
      s.id,
    )
    if (rows && rows.length) return rows[0].id
    const slug = s.slug || slugify(s.id)
    await prisma.$executeRawUnsafe(
      'INSERT INTO Supplier (id, slug, name, urlRoot, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      s.id,
      slug,
      s.name || s.id,
      s.urlRoot || null,
    )
    return s.id
  }
  const slug = slugify(String(s.slug || s.name || 'supplier'))
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    'SELECT id FROM Supplier WHERE slug = ? LIMIT 1',
    slug,
  )
  if (existing && existing.length) {
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE Supplier SET name = ?, urlRoot = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        s.name || slug,
        s.urlRoot || null,
        existing[0].id,
      )
    } catch {
      /* ignore */
    }
    return existing[0].id
  }
  const id = crypto.randomUUID()
  await prisma.$executeRawUnsafe(
    'INSERT INTO Supplier (id, slug, name, urlRoot, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    id,
    slug,
    s.name || slug,
    s.urlRoot || null,
  )
  return id
}
