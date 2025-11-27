import type { Prisma } from '@prisma/client'
import { prisma } from '../../app/db.server'
import { deriveDesignStudioAnnotations } from '../../app/lib/designStudio/annotations.server'

const toRecord = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

const resolvePartType = ({
  partType,
  norm,
  raw,
}: {
  partType?: string | null
  norm?: Record<string, unknown>
  raw?: Record<string, unknown>
}) => {
  const candidates = [partType, norm?.partType, norm?.part_type, raw?.partType, raw?.part_type]
  return candidates.find((val): val is string => typeof val === 'string' && val.trim().length > 0)
}

async function backfillPartStaging(batchSize = 50) {
  let cursor: string | null = null
  while (true) {
    const rows: Array<{
      id: string
      supplierId: string
      partType: string
      title: string
      rawSpecs: Prisma.JsonValue | null
      normSpecs: Prisma.JsonValue | null
    }> = await prisma.partStaging.findMany({
      select: {
        id: true,
        supplierId: true,
        partType: true,
        title: true,
        rawSpecs: true,
        normSpecs: true,
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (!rows.length) break
    cursor = rows[rows.length - 1].id
    const ops = rows.map(row => {
      const raw = toRecord(row.rawSpecs)
      const norm = toRecord(row.normSpecs)
      const designStudio = deriveDesignStudioAnnotations({
        supplierKey: row.supplierId,
        partType: resolvePartType({ partType: row.partType, norm, raw }) ?? row.partType,
        title: row.title,
        rawSpecs: raw,
        normSpecs: norm,
      })
      return prisma.partStaging.update({
        where: { id: row.id },
        data: {
          designStudioReady: designStudio.ready,
          designStudioFamily: designStudio.family ?? null,
          designStudioSeries: designStudio.series ?? null,
          designStudioRole: designStudio.role,
          designStudioCompatibility: designStudio.compatibility,
          designStudioCoverageNotes: designStudio.coverageNotes ?? null,
          designStudioSourceQuality: designStudio.sourceQuality ?? null,
          designStudioHash: designStudio.hash,
        } as Prisma.PartStagingUpdateInput,
      })
    })
    await prisma.$transaction(ops)
  }
}

async function backfillProductVersions(batchSize = 50) {
  let cursor: string | null = null
  while (true) {
    const rows: Array<{
      id: string
      rawSpecs: Prisma.JsonValue | null
      normSpecs: Prisma.JsonValue | null
      product: {
        supplierId: string
        type: string | null
        supplier: { slug: string | null; name: string | null } | null
      }
    }> = await prisma.productVersion.findMany({
      select: {
        id: true,
        rawSpecs: true,
        normSpecs: true,
        product: {
          select: {
            supplierId: true,
            type: true,
            supplier: { select: { slug: true, name: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (!rows.length) break
    cursor = rows[rows.length - 1].id
    const ops = rows.map(row => {
      const raw = toRecord(row.rawSpecs)
      const norm = toRecord(row.normSpecs)
      const supplierKey = row.product.supplier?.slug || row.product.supplierId
      const partType = resolvePartType({ partType: row.product.type, norm, raw })
      const designStudio = deriveDesignStudioAnnotations({
        supplierKey,
        partType,
        title: typeof norm?.title === 'string' ? (norm.title as string) : row.product.type || 'Unknown product',
        rawSpecs: raw,
        normSpecs: norm,
      })
      return prisma.productVersion.update({
        where: { id: row.id },
        data: {
          designStudioRole: designStudio.role,
          designStudioSeries: designStudio.series ?? null,
          designStudioCompatibility: designStudio.compatibility,
          designStudioSourceQuality: designStudio.sourceQuality ?? null,
          designStudioHash: designStudio.hash,
        } as Prisma.ProductVersionUpdateInput,
      })
    })
    await prisma.$transaction(ops)
  }
}

async function backfillProducts(batchSize = 50) {
  let cursor: string | null = null
  while (true) {
    const rows: Array<{
      id: string
      title: string
      type: string | null
      supplierId: string
      supplier: { slug: string | null; name: string | null } | null
      latestVersion: { rawSpecs: Prisma.JsonValue | null; normSpecs: Prisma.JsonValue | null } | null
    }> = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        type: true,
        supplierId: true,
        supplier: { select: { slug: true, name: true } },
        latestVersion: {
          select: { rawSpecs: true, normSpecs: true },
        },
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (!rows.length) break
    cursor = rows[rows.length - 1].id
    const ops = rows
      .filter(row => row.latestVersion)
      .map(row => {
        const raw = toRecord(row.latestVersion?.rawSpecs)
        const norm = toRecord(row.latestVersion?.normSpecs)
        const supplierKey = row.supplier?.slug || row.supplierId
        const partType = resolvePartType({ partType: row.type, norm, raw })
        const designStudio = deriveDesignStudioAnnotations({
          supplierKey,
          partType,
          title: row.title,
          rawSpecs: raw,
          normSpecs: norm,
        })
        return prisma.product.update({
          where: { id: row.id },
          data: {
            designStudioReady: designStudio.ready,
            designStudioFamily: designStudio.family ?? null,
            designStudioCoverageNotes: designStudio.coverageNotes ?? null,
            designStudioLastTouchedAt: new Date(),
          } as Prisma.ProductUpdateInput,
        })
      })
    if (ops.length) await prisma.$transaction(ops)
  }
}

async function main() {
  await backfillPartStaging()
  await backfillProductVersions()
  await backfillProducts()
  console.log('[design-studio] metadata backfill complete')
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  void prisma.$disconnect()
  process.exit(1)
})
