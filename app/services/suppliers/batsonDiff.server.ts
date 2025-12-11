import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import type { BatsonNormalizedRecord } from '../../domain/catalog/batsonNormalizedTypes'
import { mapNormalizedProduct } from './batsonApply.server'
import { buildSnapshotFromSource, computeDiff, type SnapshotRecord } from '../imports/computeDiff.server'
import { saveImportRunDiff } from '../imports/persistDiff.server'

export type BatsonDiffResult = Awaited<ReturnType<typeof runBatsonDiffForSlug>>

export async function runBatsonDiffForSlug(slug: string) {
  const supplier = await prisma.supplier.findUnique({ where: { slug } })
  const supplierId = supplier?.id ?? null

  const [existingRows, stagingRows] = await Promise.all([
    supplierId
      ? prisma.product.findMany({
          where: { supplierId, supplierSiteId: slug },
          select: {
            supplierSiteId: true,
            productCode: true,
            brand: true,
            series: true,
            material: true,
            color: true,
            msrp: true,
            availability: true,
            category: true,
            family: true,
            designStudioReady: true,
            attributes: true,
          },
        })
      : Promise.resolve([]),
    prisma.partStaging.findMany({
      where: { supplierId: slug },
      select: {
        supplierId: true,
        externalId: true,
        title: true,
        description: true,
        normSpecs: true,
      },
    }),
  ])

  const existingSnapshots: SnapshotRecord[] = existingRows.map(row =>
    buildSnapshotFromSource({
      supplier: slug,
      supplierSiteId: row.supplierSiteId ?? null,
      productCode: row.productCode,
      brand: row.brand,
      series: row.series,
      material: row.material,
      color: row.color,
      msrp: row.msrp,
      availability: row.availability,
      category: row.category ?? undefined,
      family: row.family ?? undefined,
      designStudioReady: row.designStudioReady,
      attributes: row.attributes,
    }),
  )

  const stagingSnapshots: SnapshotRecord[] = stagingRows
    .map(row => snapshotFromStagingRow(slug, supplierId, row.normSpecs, row.title, row.description))
    .filter((entry): entry is SnapshotRecord => Boolean(entry))

  const { diffs, summary } = computeDiff(existingSnapshots, stagingSnapshots)

  const runResult = await saveImportRunDiff({
    supplierSlug: slug,
    supplierId,
    diffs,
    startedAt: new Date(),
    finishedAt: new Date(),
    status: 'diffed',
    summary: buildSummaryPayload(slug, summary, existingSnapshots.length, stagingSnapshots.length),
  })

  return {
    run: runResult.run,
    counts: runResult.counts,
    summary,
    totalExisting: existingSnapshots.length,
    totalStaging: stagingSnapshots.length,
  }
}

function snapshotFromStagingRow(
  slug: string,
  supplierId: string | null,
  specs: Prisma.JsonValue | null,
  title: string,
  description?: string | null,
): SnapshotRecord | null {
  const normalized = (specs as BatsonNormalizedRecord | null) ?? null
  if (!isNormalizedRecord(normalized)) return null
  const canonical = mapNormalizedProduct({
    supplierId: supplierId ?? slug,
    supplierSiteId: slug,
    title,
    description: description ?? null,
    normalized,
  })
  return buildSnapshotFromSource({
    supplier: slug,
    supplierSiteId: slug,
    productCode: canonical.productCode,
    brand: canonical.brand,
    series: canonical.series,
    material: canonical.material,
    color: canonical.color,
    msrp: canonical.msrp ?? undefined,
    availability: canonical.availability ?? undefined,
    category: canonical.category,
    family: canonical.family ?? undefined,
    designStudioReady: canonical.designStudioReady,
    attributes:
      canonical.attributes && typeof canonical.attributes === 'object'
        ? (canonical.attributes as Record<string, unknown>)
        : undefined,
  })
}

function isNormalizedRecord(value: unknown): value is BatsonNormalizedRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.productCode === 'string' && typeof record.family === 'string'
}

function buildSummaryPayload(
  slug: string,
  counts: { adds: number; changes: number; deletes: number },
  existingCount: number,
  stagingCount: number,
): Prisma.JsonValue {
  return {
    supplierSlug: slug,
    totals: {
      existing: existingCount,
      staging: stagingCount,
    },
    diffs: counts,
  }
}
