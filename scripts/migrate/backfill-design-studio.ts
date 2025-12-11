import type { Prisma } from '@prisma/client'
import { prisma } from '../../app/db.server'
import { deriveDesignStudioAnnotations, normalizeDesignPartType } from '../../app/lib/designStudio/annotations.server'
import { evaluateDesignStudioReadiness, formatBlockingReasons } from '../../app/lib/designStudio/readiness.server'

const toRecord = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

const toNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'object' && 'toNumber' in (value as Prisma.Decimal)) {
    try {
      return (value as Prisma.Decimal).toNumber()
    } catch {
      return null
    }
  }
  const parsed = Number(value as unknown)
  return Number.isFinite(parsed) ? parsed : null
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
      images: Prisma.JsonValue | null
      priceMsrp: Prisma.Decimal | null
      priceWh: Prisma.Decimal | null
      availability: string | null
    }> = await prisma.partStaging.findMany({
      select: {
        id: true,
        supplierId: true,
        partType: true,
        title: true,
        rawSpecs: true,
        normSpecs: true,
        images: true,
        priceMsrp: true,
        priceWh: true,
        availability: true,
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
      const resolvedPartType = resolvePartType({ partType: row.partType, norm, raw }) ?? row.partType
      const designPartType = normalizeDesignPartType(resolvedPartType)
      const designStudio = deriveDesignStudioAnnotations({
        supplierKey: row.supplierId,
        partType: resolvedPartType,
        title: row.title,
        rawSpecs: raw,
        normSpecs: norm,
      })
      const readiness = evaluateDesignStudioReadiness({
        designPartType,
        annotation: designStudio,
        priceMsrp: toNumber(row.priceMsrp),
        priceWholesale: toNumber(row.priceWh),
        availability: row.availability ?? null,
        images: row.images,
      })
      const blockingReasons = readiness.ready ? null : readiness.reasons
      const readinessNotes = formatBlockingReasons(blockingReasons || []) || designStudio.coverageNotes
      const coverageNotes = readiness.ready ? (designStudio.coverageNotes ?? null) : (readinessNotes ?? null)
      return prisma.partStaging.update({
        where: { id: row.id },
        data: {
          designStudioReady: readiness.ready,
          designStudioFamily: designStudio.family ?? null,
          designStudioSeries: designStudio.series ?? null,
          designStudioRole: designStudio.role,
          designStudioCompatibility: designStudio.compatibility,
          designStudioCoverageNotes: coverageNotes,
          designStudioSourceQuality: designStudio.sourceQuality ?? null,
          designStudioHash: designStudio.hash,
          designPartType,
          designStudioBlockingReasons: blockingReasons,
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
      images: Prisma.JsonValue | null
      description: string | null
      priceMsrp: Prisma.Decimal | null
      priceWholesale: Prisma.Decimal | null
      availability: string | null
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
        images: true,
        description: true,
        priceMsrp: true,
        priceWholesale: true,
        availability: true,
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
      const designPartType = normalizeDesignPartType(partType)
      const designStudio = deriveDesignStudioAnnotations({
        supplierKey,
        partType,
        title: typeof norm?.title === 'string' ? (norm.title as string) : row.product.type || 'Unknown product',
        rawSpecs: raw,
        normSpecs: norm,
      })
      const readiness = evaluateDesignStudioReadiness({
        designPartType,
        annotation: designStudio,
        priceMsrp: toNumber(row.priceMsrp),
        priceWholesale: toNumber(row.priceWholesale),
        availability: row.availability ?? null,
        images: row.images,
      })
      const blockingReasons = readiness.ready ? null : readiness.reasons
      const readinessNotes = formatBlockingReasons(blockingReasons || []) || designStudio.coverageNotes
      const coverageNotes = readiness.ready ? (designStudio.coverageNotes ?? null) : (readinessNotes ?? null)
      return prisma.productVersion.update({
        where: { id: row.id },
        data: {
          designPartType,
          designStudioReady: readiness.ready,
          designStudioFamily: designStudio.family ?? null,
          designStudioRole: designStudio.role,
          designStudioSeries: designStudio.series ?? null,
          designStudioCompatibility: designStudio.compatibility,
          designStudioSourceQuality: designStudio.sourceQuality ?? null,
          designStudioCoverageNotes: coverageNotes,
          designStudioHash: designStudio.hash,
          designStudioBlockingReasons: blockingReasons,
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
      latestVersion: {
        rawSpecs: Prisma.JsonValue | null
        normSpecs: Prisma.JsonValue | null
        images: Prisma.JsonValue | null
        priceMsrp: Prisma.Decimal | null
        priceWholesale: Prisma.Decimal | null
        availability: string | null
        description: string | null
      } | null
    }> = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        type: true,
        supplierId: true,
        supplier: { select: { slug: true, name: true } },
        latestVersion: {
          select: {
            rawSpecs: true,
            normSpecs: true,
            images: true,
            priceMsrp: true,
            priceWholesale: true,
            availability: true,
            description: true,
          },
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
        const designPartType = normalizeDesignPartType(partType)
        const readiness = evaluateDesignStudioReadiness({
          designPartType,
          annotation: designStudio,
          priceMsrp: toNumber(row.latestVersion?.priceMsrp ?? null),
          priceWholesale: toNumber(row.latestVersion?.priceWholesale ?? null),
          availability: row.latestVersion?.availability ?? null,
          images: row.latestVersion?.images,
        })
        const blockingReasons = readiness.ready ? null : readiness.reasons
        const readinessNotes = formatBlockingReasons(blockingReasons || []) || designStudio.coverageNotes
        const coverageNotes = readiness.ready ? (designStudio.coverageNotes ?? null) : (readinessNotes ?? null)
        return prisma.product.update({
          where: { id: row.id },
          data: {
            designStudioReady: readiness.ready,
            designStudioFamily: designStudio.family ?? null,
            designStudioSeries: designStudio.series ?? null,
            designStudioRole: designStudio.role,
            designStudioCompatibility: designStudio.compatibility,
            designStudioSourceQuality: designStudio.sourceQuality ?? null,
            designStudioHash: designStudio.hash,
            designStudioCoverageNotes: coverageNotes,
            designStudioLastTouchedAt: new Date(),
            designPartType,
            msrp: row.latestVersion?.priceMsrp ?? null,
            priceWholesale: row.latestVersion?.priceWholesale ?? null,
            availability: row.latestVersion?.availability ?? null,
            images: row.latestVersion?.images ?? null,
            description: row.latestVersion?.description ?? null,
            designStudioBlockingReasons: blockingReasons,
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
