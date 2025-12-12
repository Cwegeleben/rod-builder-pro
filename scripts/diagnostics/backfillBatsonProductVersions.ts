#!/usr/bin/env tsx
import { createHash } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { deriveDesignStudioAnnotations } from '../../app/lib/designStudio/annotations.server'

const prisma = new PrismaClient()
const TARGET_SUPPLIER_SLUG = 'batson'

function hashPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload ?? {}))
    .digest('hex')
}

function toStorefrontRole(value?: string | null): string | null {
  if (!value) return null
  const upper = value.toUpperCase()
  switch (upper) {
    case 'BLANK':
      return 'blank'
    case 'GUIDE':
      return 'guide'
    case 'GUIDE_SET':
      return 'guide_set'
    case 'GUIDE_TIP':
    case 'TIP_TOP':
      return 'guide_tip'
    case 'REEL_SEAT':
      return 'reel_seat'
    case 'HANDLE':
      return 'handle'
    case 'COMPONENT':
      return 'component'
    case 'ACCESSORY':
      return 'accessory'
    case 'BUTT_CAP':
      return 'butt_cap'
    default:
      return value.toLowerCase()
  }
}

function normalizeImages(
  primary?: Prisma.InputJsonValue | null,
  fallback?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | null,
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
  if (primary != null) return primary
  if (fallback && fallback !== Prisma.JsonNull) return fallback
  return Prisma.JsonNull
}

async function main() {
  const forceRefresh = process.env.FORCE_REFRESH === '1'
  const supplier = await prisma.supplier.findUnique({ where: { slug: TARGET_SUPPLIER_SLUG } })
  if (!supplier) {
    console.error(`[backfillBatsonProductVersions] Supplier ${TARGET_SUPPLIER_SLUG} not found`)
    return
  }

  const targets = await prisma.product.findMany({
    where: {
      supplierId: supplier.id,
      designStudioReady: true,
      ...(forceRefresh ? {} : { latestVersionId: null }),
    },
    select: {
      id: true,
      productCode: true,
      title: true,
      description: true,
      images: true,
      msrp: true,
      priceWholesale: true,
      availability: true,
      attributes: true,
      designStudioFamily: true,
      designStudioSeries: true,
      designStudioRole: true,
      designPartType: true,
    },
  })

  if (!targets.length) {
    console.log('[backfillBatsonProductVersions] No Batson products need backfill')
    return
  }

  const supplierKeys = Array.from(new Set([supplier.id, supplier.slug].filter(Boolean))) as string[]
  const updated: { id: string; sku: string; latestVersionId: string }[] = []
  let skippedNoStaging = 0
  let skippedNoNormSpecs = 0

  for (const product of targets) {
    const staging = await prisma.partStaging.findFirst({
      where: {
        supplierId: { in: supplierKeys },
        externalId: product.productCode,
      },
      orderBy: { fetchedAt: 'desc' },
      select: {
        normSpecs: true,
        rawSpecs: true,
        description: true,
        images: true,
        priceMsrp: true,
        priceWh: true,
        availability: true,
        fetchedAt: true,
      },
    })

    if (!staging) {
      skippedNoStaging += 1
      continue
    }

    const normalized = staging.normSpecs as Prisma.InputJsonValue | null
    if (!normalized) {
      skippedNoNormSpecs += 1
      continue
    }

    const annotation = deriveDesignStudioAnnotations({
      supplierKey: TARGET_SUPPLIER_SLUG,
      partType: product.designPartType,
      title: product.title,
      normSpecs: normalized as Record<string, unknown>,
    })
    const imagePayload = normalizeImages(
      staging.images as Prisma.InputJsonValue | null,
      (product.images as Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | null) ?? null,
    )
    const priceMsrp = product.msrp ?? (staging.priceMsrp as Prisma.Decimal | null) ?? null
    const priceWholesale = product.priceWholesale ?? (staging.priceWh as Prisma.Decimal | null) ?? null
    const availability = product.availability ?? staging.availability ?? null
    const versionRole = toStorefrontRole(product.designStudioRole)
    const versionHash = hashPayload({
      normalized,
      attributes: product.attributes,
      msrp: priceMsrp ? priceMsrp.toString() : null,
      availability,
      role: versionRole,
      images: imagePayload && imagePayload !== Prisma.JsonNull ? imagePayload : null,
    })

    const version = await prisma.productVersion.create({
      data: {
        productId: product.id,
        designPartType: product.designPartType,
        contentHash: versionHash,
        rawSpecs: staging.rawSpecs ?? Prisma.JsonNull,
        normSpecs: normalized,
        description: (staging.description as string | null) ?? product.description ?? null,
        images: imagePayload,
        priceMsrp,
        priceWholesale,
        availability,
        sourceSnapshot: Prisma.JsonNull,
        fetchedAt: staging.fetchedAt ?? new Date(),
        designStudioReady: true,
        designStudioFamily: product.designStudioFamily ?? annotation.family ?? null,
        designStudioRole: versionRole,
        designStudioSeries: product.designStudioSeries ?? annotation.series ?? null,
        designStudioCompatibility: (annotation.compatibility as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        designStudioSourceQuality: annotation.sourceQuality ?? null,
        designStudioCoverageNotes: annotation.coverageNotes ?? null,
        designStudioHash: annotation.hash,
        designStudioBlockingReasons: Prisma.JsonNull,
      },
    })

    await prisma.product.update({
      where: { id: product.id },
      data: {
        latestVersionId: version.id,
        designStudioHash: annotation.hash,
        designStudioLastTouchedAt: new Date(),
      },
    })

    updated.push({ id: product.id, sku: product.productCode, latestVersionId: version.id })
  }

  console.log(
    JSON.stringify(
      {
        telemetry: 'backfillBatsonProductVersions',
        inspected: targets.length,
        updated: updated.length,
        forceRefresh,
        skippedNoStaging,
        skippedNoNormSpecs,
        sample: updated[0] ?? null,
      },
      null,
      2,
    ),
  )
}

main()
  .catch(err => {
    console.error('[backfillBatsonProductVersions] failed', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
