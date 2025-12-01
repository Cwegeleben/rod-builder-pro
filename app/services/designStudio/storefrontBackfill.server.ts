import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import { upsertNormalizedProduct } from '../productDbWriter.server'

export type DesignStorefrontBackfillOptions = {
  supplierId?: string
  supplierIds?: string[]
  templateId?: string | null
  includeNeedsReview?: boolean
  externalIds?: string[]
  limit?: number
  batchSize?: number
}

export type DesignStorefrontBackfillResult = {
  processed: number
  created: number
  changed: number
  skipped: number
  failed: number
}

type PartStagingRow = {
  id: string
  supplierId: string
  templateId: string | null
  externalId: string | null
  title: string
  partType: string
  description: string | null
  images: Prisma.JsonValue | null
  rawSpecs: Prisma.JsonValue | null
  normSpecs: Prisma.JsonValue | null
  priceMsrp: Prisma.Decimal | number | null
  priceWh: Prisma.Decimal | number | null
  fetchedAt: Date | null
  designStudioReady: boolean | null
  availability: string | null
}

const DEFAULT_BATCH_SIZE = 50

export async function backfillDesignStorefrontProducts(
  options: DesignStorefrontBackfillOptions,
): Promise<DesignStorefrontBackfillResult> {
  const supplierIds = options.supplierIds?.filter(Boolean) ?? (options.supplierId ? [options.supplierId] : [])
  if (!supplierIds.length) {
    throw new Error('backfillDesignStorefrontProducts requires supplierId or supplierIds')
  }

  const totals: DesignStorefrontBackfillResult = {
    processed: 0,
    created: 0,
    changed: 0,
    skipped: 0,
    failed: 0,
  }

  for (const supplierId of supplierIds) {
    await backfillForSupplier({ ...options, supplierId }, totals)
    if (options.limit && totals.processed >= options.limit) break
  }

  return totals
}

async function backfillForSupplier(
  options: DesignStorefrontBackfillOptions & { supplierId: string },
  totals: DesignStorefrontBackfillResult,
) {
  const batchSize = Math.max(options.batchSize || DEFAULT_BATCH_SIZE, 1)
  const includeNeedsReview = options.includeNeedsReview !== false
  const where: Prisma.PartStagingWhereInput = {
    supplierId: options.supplierId,
    ...(options.templateId !== undefined ? { templateId: options.templateId } : {}),
    ...(options.externalIds?.length ? { externalId: { in: options.externalIds } } : {}),
    ...(includeNeedsReview ? {} : { designStudioReady: true }),
  }

  let cursor: string | null = null
  while (true) {
    const rows = (await prisma.partStaging.findMany({
      where,
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        supplierId: true,
        templateId: true,
        externalId: true,
        title: true,
        partType: true,
        description: true,
        images: true,
        rawSpecs: true,
        normSpecs: true,
        priceMsrp: true,
        priceWh: true,
        fetchedAt: true,
        designStudioReady: true,
        availability: true,
      },
    })) as PartStagingRow[]

    if (!rows.length) break
    cursor = rows[rows.length - 1].id

    for (const row of rows) {
      if (options.limit && totals.processed >= options.limit) return
      const sku = row.externalId?.trim()
      if (!sku) {
        totals.failed += 1
        totals.processed += 1
        continue
      }
      if (!includeNeedsReview && row.designStudioReady === false) {
        totals.skipped += 1
        totals.processed += 1
        continue
      }
      try {
        const res = await upsertNormalizedProduct({
          supplier: { id: row.supplierId },
          sku,
          title: row.title || sku,
          type: row.partType || null,
          description: row.description || undefined,
          images: toJson(row.images),
          rawSpecs: toJson(row.rawSpecs),
          normSpecs: toJson(row.normSpecs),
          priceMsrp: toNumber(row.priceMsrp),
          priceWholesale: toNumber(row.priceWh),
          availability: row.availability || extractAvailability(row.normSpecs),
          sources: buildSources(row),
          fetchedAt: row.fetchedAt || new Date(),
        })
        if (res.createdProduct) totals.created += 1
        else if (res.createdVersion) totals.changed += 1
        else totals.skipped += 1
      } catch (error) {
        totals.failed += 1
        console.warn('[designStudioBackfill] upsert failed', {
          supplierId: row.supplierId,
          sku,
          error,
        })
      }
      totals.processed += 1
    }
  }
}

function toJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null
  return value as Prisma.InputJsonValue
}

function toNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    try {
      return value.toNumber()
    } catch {
      return null
    }
  }
  const parsed = Number(value as unknown)
  return Number.isFinite(parsed) ? parsed : null
}

function extractAvailability(specs: Prisma.JsonValue | null): string | null {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return null
  const record = specs as Record<string, unknown>
  const candidate = record.availability ?? record.Availability ?? record.status
  return typeof candidate === 'string' && candidate.trim().length ? candidate.trim() : null
}

function buildSources(row: PartStagingRow) {
  const parts = [`partstaging://${row.supplierId}`]
  if (row.templateId) parts.push(row.templateId)
  parts.push(row.externalId || row.id)
  return [
    {
      url: parts.join('/'),
      source: row.templateId ? `template:${row.templateId}` : 'part-staging',
    },
  ]
}
