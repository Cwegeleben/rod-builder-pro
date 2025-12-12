import { createHash } from 'node:crypto'
import { Prisma, ProductStatus } from '@prisma/client'
import { deriveDesignStudioAnnotations } from '../../lib/designStudio/annotations.server'
import { prisma } from '../../db.server'
import type {
  AvailabilityState,
  BatsonNormalizedRecord,
  BatsonProductCategory,
  NormalizedBlank,
  NormalizedEndCap,
  NormalizedGuide,
  NormalizedGrip,
  NormalizedReelSeat,
  NormalizedTipTop,
  NormalizedTrim,
} from '../../domain/catalog/batsonNormalizedTypes'

export type ProductCategory = BatsonProductCategory

export type BatsonApplyInput = {
  supplierId: string
  supplierSiteId?: string | null
  title: string
  description?: string | null
  images?: Prisma.InputJsonValue | null
  normalized: BatsonNormalizedRecord
}

export type BatsonApplyOptions = {
  mirror?: boolean
}

export type BatsonApplyResult = {
  upserts: number
  deactivated: number
}

const BLANK_FAMILIES = new Set<NormalizedBlank['family']>([
  'spinningBlank',
  'castingBlank',
  'flyBlank',
  'surfBlank',
  'saltwaterBlank',
  'centerPinBlank',
  'iceBlank',
  'glassBlank',
  'compositeBlank',
  'trollingBlank',
])
const GUIDE_FAMILIES = new Set<NormalizedGuide['family']>([
  'singleFootGuide',
  'doubleFootGuide',
  'flyGuide',
  'castingBoatGuide',
  'microGuide',
  'rollerGuide',
  'guideKit',
])
const TIP_TOP_FAMILIES = new Set<NormalizedTipTop['family']>([
  'castingTipTop',
  'spinningTipTop',
  'flyTipTop',
  'rollerTipTop',
  'microTipTop',
  'boatTipTop',
])
const GRIP_FAMILIES = new Set<NormalizedGrip['family']>([
  'splitGrip',
  'rearGrip',
  'foreGrip',
  'fullWells',
  'halfWells',
  'fightingButt',
  'switchGrip',
  'carbonSplitGrip',
  'carbonRearGrip',
  'winnGrip',
  'iceGrip',
])
const REEL_SEAT_FAMILIES = new Set<NormalizedReelSeat['family']>([
  'spinningSeat',
  'castingSeat',
  'triggerCastingSeat',
  'flySeat',
  'trollingSeat',
  'saltwaterSeat',
  'iceSeat',
  'railSeat',
])
const TRIM_FAMILIES = new Set<NormalizedTrim['family']>([
  'trimRing',
  'pipeExtension',
  'windingCheck',
  'lockingRing',
  'hookKeeper',
  'decorativeTrim',
  'buttWrap',
  'carbonTube',
])
const END_CAP_FAMILIES = new Set<NormalizedEndCap['family']>([
  'buttCap',
  'rubberCap',
  'evaCap',
  'pvcCap',
  'fightingButtCap',
  'gimbal',
  'aluminumCap',
  'carbonButtCap',
])

const CATEGORY_DESIGN_PART: Record<ProductCategory, string> = {
  blank: 'BLANK',
  guide: 'GUIDE',
  tipTop: 'GUIDE_TIP',
  grip: 'HANDLE',
  reelSeat: 'REEL_SEAT',
  trim: 'COMPONENT',
  endCap: 'BUTT_CAP',
}

const AVAILABILITY_MAP: Record<AvailabilityState, string> = {
  inStock: 'IN_STOCK',
  outOfStock: 'OUT_OF_STOCK',
  discontinued: 'DISCONTINUED',
  preorder: 'PREORDER',
}

const BLANK_ATTRIBUTE_KEYS = [
  'itemTotalLengthIn',
  'numberOfPieces',
  'power',
  'action',
  'application',
  'blankType',
  'materialConstruction',
  'lineRating',
  'lureRating',
  'tipOD_mm',
  'buttOD_mm',
  'blankWeightOz',
  'intrinsicPower_g',
  'actionAngle_deg',
  'ern',
  'tenInDiameter_mm',
  'twentyInDiameter_mm',
  'thirtyInDiameter_mm',
  'finish',
  'notes',
  'suitableFor',
] as const

const GUIDE_ATTRIBUTE_KEYS = [
  'frameMaterial',
  'frameMaterialCode',
  'frameFinish',
  'ringMaterial',
  'ringMaterialCode',
  'ringSize',
  'tubeSize',
  'footType',
  'height_mm',
  'weightOz',
  'footLength_mm',
  'frameProfile',
  'usageHints',
  'kitContents',
] as const

const TIP_TOP_ATTRIBUTE_KEYS = [
  'frameMaterial',
  'frameMaterialCode',
  'frameFinish',
  'ringMaterial',
  'ringMaterialCode',
  'ringSize',
  'tubeSize',
  'tipTopType',
  'loopStyle',
  'displayName',
  'weightOz',
  'height_mm',
  'notes',
  'pricingTier',
  'tipTop',
] as const

const GRIP_ATTRIBUTE_KEYS = [
  'itemLengthIn',
  'insideDiameterIn',
  'frontODIn',
  'rearODIn',
  'profileShape',
  'gripPosition',
  'weight_g',
  'urethaneFilled',
  'winnPattern',
  'texture',
  'notes',
] as const

const REEL_SEAT_ATTRIBUTE_KEYS = [
  'seatSize',
  'itemLengthIn',
  'insideDiameterIn',
  'bodyOutsideDiameterIn',
  'seatOrientation',
  'hoodOutsideDiameterIn',
  'insertMaterial',
  'threadSpec',
  'hardwareFinish',
  'weightOz',
] as const

const TRIM_ATTRIBUTE_KEYS = [
  'itemLengthIn',
  'insideDiameterIn',
  'outsideDiameterIn',
  'heightIn',
  'weightOz',
  'plating',
  'pattern',
  'notes',
] as const

const END_CAP_ATTRIBUTE_KEYS = [
  'itemLengthIn',
  'insideDiameterIn',
  'outsideDiameterIn',
  'endCapDepthIn',
  'weightOz',
  'capStyle',
  'isGimbal',
  'hardwareInterface',
  'notes',
] as const

type ProductRowInput = {
  supplierId: string
  supplierSiteId?: string | null
  productCode: string
  title: string
  description?: string | null
  images?: Prisma.InputJsonValue | null
  type?: string | null
  category: ProductCategory
  family?: string | null
  brand?: string | null
  series?: string | null
  material?: string | null
  color?: string | null
  designPartType?: string | null
  designStudioRole?: string | null
  msrp?: Prisma.Decimal | null
  availability?: string | null
  designStudioReady: boolean
  attributes: Prisma.InputJsonValue | null
}

type ProductUpsertPayload = {
  supplierSiteId: string | null
  title: string
  description: string | null
  images: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull
  type: string | null
  category: ProductCategory
  family: string | null
  brand: string | null
  series: string | null
  material: string | null
  color: string | null
  designPartType: string | null
  designStudioRole: string | null
  msrp: Prisma.Decimal | null
  availability: string | null
  designStudioReady: boolean
  attributes: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull
  active: boolean
  updatedAt: Date
}

export function mapNormalizedProduct(input: BatsonApplyInput): ProductRowInput {
  const { normalized } = input
  const category = normalized.category ?? determineCategory(normalized)
  const msrp = normalized.msrp != null ? new Prisma.Decimal(normalized.msrp) : null
  const availability = normalized.availability ? (AVAILABILITY_MAP[normalized.availability] ?? null) : null
  const attributes = buildAttributes(normalized, category)
  const designStudioReady = computeDesignStudioReady(normalized, category)
  const images = ensureImagesPayload(input.images, normalized.imageUrl ?? null)
  const designStudioRole = normalized.designStudioRole ?? CATEGORY_DESIGN_PART[category]

  return {
    supplierId: input.supplierId,
    supplierSiteId: input.supplierSiteId ?? null,
    productCode: normalized.productCode.trim(),
    title: input.title,
    description: input.description ?? null,
    images,
    type: category,
    category,
    family: normalized.family,
    brand: normalized.brand,
    series: normalized.series,
    material: normalized.material,
    color: normalized.color,
    designPartType: CATEGORY_DESIGN_PART[category],
    designStudioRole,
    msrp,
    availability,
    designStudioReady,
    attributes,
  }
}

export async function applyBatsonProducts(
  rows: BatsonApplyInput[],
  options: BatsonApplyOptions = {},
): Promise<BatsonApplyResult> {
  if (!rows.length) return { upserts: 0, deactivated: 0 }
  const seenBySupplier = new Map<string, Set<string>>()
  const supplierSlugCache = new Map<string, string | null>()
  let upserts = 0

  for (const row of rows) {
    const mapped = mapNormalizedProduct(row)
    const seen = seenBySupplier.get(mapped.supplierId) ?? new Set<string>()
    seen.add(mapped.productCode)
    seenBySupplier.set(mapped.supplierId, seen)

    const data = buildUpsertData(mapped)
    const product = await prisma.product.upsert({
      where: {
        product_supplier_product_code_unique: {
          supplierId: mapped.supplierId,
          productCode: mapped.productCode,
        },
      },
      create: {
        ...data,
        supplierId: mapped.supplierId,
        productCode: mapped.productCode,
        status: ProductStatus.READY,
      },
      update: data,
    })
    const supplierSlug = await resolveSupplierSlug(mapped.supplierId, supplierSlugCache)
    const isBatson = isBatsonSupplier(supplierSlug) || isBatsonSupplier(row.supplierSiteId)

    if (isBatson) {
      await writeBatsonProductVersion({
        productId: product.id,
        mapped,
        normalized: row.normalized,
        description: row.description ?? null,
        images: row.images ?? null,
      })
    }

    upserts += 1
  }

  let deactivated = 0
  if (options.mirror) {
    for (const [supplierId, codes] of seenBySupplier.entries()) {
      const result = await prisma.product.updateMany({
        where: { supplierId, productCode: { notIn: [...codes] }, active: true },
        data: { active: false },
      })
      deactivated += result.count
    }
  }

  return { upserts, deactivated }
}

function buildUpsertData(mapped: ProductRowInput): ProductUpsertPayload {
  return {
    supplierSiteId: mapped.supplierSiteId ?? null,
    title: mapped.title,
    description: mapped.description ?? null,
    images: mapped.images ?? Prisma.JsonNull,
    type: mapped.type ?? null,
    category: mapped.category,
    family: mapped.family ?? null,
    brand: mapped.brand ?? null,
    series: mapped.series ?? null,
    material: mapped.material ?? null,
    color: mapped.color ?? null,
    designPartType: mapped.designPartType ?? null,
    msrp: mapped.msrp ?? null,
    availability: mapped.availability ?? null,
    designStudioReady: mapped.designStudioReady,
    designStudioRole: mapped.designStudioRole ?? null,
    attributes: mapped.attributes ?? Prisma.JsonNull,
    active: true,
    updatedAt: new Date(),
  }
}

const BATSON_SLUG = 'batson'

async function resolveSupplierSlug(supplierId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(supplierId)) return cache.get(supplierId) ?? null
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { slug: true } })
  const slug = supplier?.slug ?? null
  cache.set(supplierId, slug)
  return slug
}

function isBatsonSupplier(value?: string | null): boolean {
  if (!value) return false
  return value.trim().toLowerCase() === BATSON_SLUG
}

type BatsonVersionContext = {
  productId: string
  mapped: ProductRowInput
  normalized: BatsonNormalizedRecord
  description?: string | null
  images?: Prisma.InputJsonValue | null
}

async function writeBatsonProductVersion(ctx: BatsonVersionContext): Promise<void> {
  const mappedImages = (ctx.mapped.images ?? null) as Prisma.InputJsonValue | null
  const versionImagesInput = ctx.images ?? mappedImages
  const dsAnnotation = deriveDesignStudioAnnotations({
    supplierKey: BATSON_SLUG,
    partType: ctx.mapped.designPartType,
    title: ctx.mapped.title,
    normSpecs: ctx.normalized as unknown as Record<string, unknown>,
  })
  const compatibilityPayload = buildCompatibilityPayload(ctx.normalized, dsAnnotation.compatibility)

  const versionHash = hashDesignStudioPayload({
    normalized: ctx.normalized,
    attributes: ctx.mapped.attributes,
    msrp: ctx.mapped.msrp ? ctx.mapped.msrp.toString() : null,
    availability: ctx.mapped.availability,
    role: ctx.mapped.designStudioRole,
    images: versionImagesInput ?? null,
  })

  const existing = await prisma.productVersion.findFirst({
    where: { productId: ctx.productId, contentHash: versionHash },
    select: { id: true },
  })

  const versionId = existing
    ? existing.id
    : (
        await prisma.productVersion.create({
          data: {
            productId: ctx.productId,
            designPartType: ctx.mapped.designPartType ?? null,
            contentHash: versionHash,
            rawSpecs: Prisma.JsonNull,
            normSpecs: (ctx.normalized as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            description: ctx.description ?? null,
            images: versionImagesInput ?? Prisma.JsonNull,
            priceMsrp: ctx.mapped.msrp ?? null,
            priceWholesale: null,
            availability: ctx.mapped.availability ?? null,
            sourceSnapshot: Prisma.JsonNull,
            fetchedAt: new Date(),
            designStudioReady: ctx.mapped.designStudioReady,
            designStudioFamily: ctx.mapped.family ?? dsAnnotation.family ?? null,
            designStudioRole: toStorefrontRole(ctx.mapped.designStudioRole),
            designStudioSeries: ctx.mapped.series ?? dsAnnotation.series ?? null,
            designStudioCompatibility: compatibilityPayload ?? Prisma.JsonNull,
            designStudioSourceQuality: dsAnnotation.sourceQuality ?? null,
            designStudioCoverageNotes: dsAnnotation.coverageNotes ?? null,
            designStudioHash: dsAnnotation.hash,
            designStudioBlockingReasons: Prisma.JsonNull,
          },
        })
      ).id

  await prisma.product.update({
    where: { id: ctx.productId },
    data: {
      latestVersionId: versionId,
      designStudioHash: dsAnnotation.hash,
      designStudioLastTouchedAt: new Date(),
    },
  })
}

function hashDesignStudioPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload ?? {})
  return createHash('sha256').update(serialized).digest('hex')
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

function buildCompatibilityPayload(record: BatsonNormalizedRecord, base: unknown): Prisma.InputJsonValue | null {
  const baseRecord = (base as Prisma.InputJsonValue) ?? null
  if ((record as { category?: string }).category === 'grip') {
    const grip = record as NormalizedGrip
    const payload = {
      ...(typeof baseRecord === 'object' && baseRecord ? (baseRecord as Record<string, unknown>) : {}),
      itemLengthIn: grip.itemLengthIn ?? null,
      insideDiameterIn: grip.insideDiameterIn ?? null,
      frontODIn: grip.frontODIn ?? null,
      rearODIn: grip.rearODIn ?? null,
      gripPosition: grip.gripPosition ?? null,
      profileShape: grip.profileShape ?? null,
    }
    return payload as Prisma.InputJsonValue
  }
  if ((record as { category?: string }).category === 'trim') {
    const trim = record as NormalizedTrim
    const payload = {
      ...(typeof baseRecord === 'object' && baseRecord ? (baseRecord as Record<string, unknown>) : {}),
      itemLengthIn: trim.itemLengthIn ?? null,
      heightIn: trim.heightIn ?? null,
      insideDiameterIn: trim.insideDiameterIn ?? null,
      outsideDiameterIn: trim.outsideDiameterIn ?? null,
      plating: trim.plating ?? null,
      pattern: trim.pattern ?? null,
    }
    return payload as Prisma.InputJsonValue
  }
  if ((record as { category?: string }).category === 'endCap') {
    const cap = record as NormalizedEndCap
    const payload = {
      ...(typeof baseRecord === 'object' && baseRecord ? (baseRecord as Record<string, unknown>) : {}),
      itemLengthIn: cap.itemLengthIn ?? null,
      endCapDepthIn: cap.endCapDepthIn ?? null,
      insideDiameterIn: cap.insideDiameterIn ?? null,
      outsideDiameterIn: cap.outsideDiameterIn ?? null,
      capStyle: cap.capStyle ?? null,
      isGimbal: cap.isGimbal ?? null,
      mountInterface: cap.hardwareInterface ?? null,
    }
    return payload as Prisma.InputJsonValue
  }
  if ((record as { category?: string }).category !== 'reelSeat') {
    return baseRecord
  }
  const seat = record as NormalizedReelSeat
  const payload = {
    ...(typeof baseRecord === 'object' && baseRecord ? (baseRecord as Record<string, unknown>) : {}),
    seatSize: seat.seatSize ?? null,
    insideDiameterIn: seat.insideDiameterIn ?? null,
    bodyOutsideDiameterIn: seat.bodyOutsideDiameterIn ?? null,
    seatOrientation: seat.seatOrientation ?? null,
    hardwareFinish: seat.hardwareFinish ?? null,
  }
  return payload as Prisma.InputJsonValue
}

function determineCategory(record: BatsonNormalizedRecord): ProductCategory {
  if (BLANK_FAMILIES.has(record.family as NormalizedBlank['family'])) return 'blank'
  if (GUIDE_FAMILIES.has(record.family as NormalizedGuide['family'])) return 'guide'
  if (TIP_TOP_FAMILIES.has(record.family as NormalizedTipTop['family'])) return 'tipTop'
  if (GRIP_FAMILIES.has(record.family as NormalizedGrip['family'])) return 'grip'
  if (REEL_SEAT_FAMILIES.has(record.family as NormalizedReelSeat['family'])) return 'reelSeat'
  if (TRIM_FAMILIES.has(record.family as NormalizedTrim['family'])) return 'trim'
  if (END_CAP_FAMILIES.has(record.family as NormalizedEndCap['family'])) return 'endCap'
  throw new Error(`Unknown Batson family: ${record.family}`)
}

function buildAttributes(record: BatsonNormalizedRecord, category: ProductCategory): Prisma.InputJsonValue | null {
  if (category === 'blank') return pickAttributes(record, BLANK_ATTRIBUTE_KEYS)
  if (category === 'guide') return pickAttributes(record, GUIDE_ATTRIBUTE_KEYS)
  if (category === 'tipTop') return pickAttributes(record, TIP_TOP_ATTRIBUTE_KEYS)
  if (category === 'grip') return pickAttributes(record, GRIP_ATTRIBUTE_KEYS)
  if (category === 'reelSeat') return pickAttributes(record, REEL_SEAT_ATTRIBUTE_KEYS)
  if (category === 'trim') return pickAttributes(record, TRIM_ATTRIBUTE_KEYS)
  if (category === 'endCap') return pickAttributes(record, END_CAP_ATTRIBUTE_KEYS)
  return null
}

function pickAttributes(source: BatsonNormalizedRecord, keys: readonly string[]): Prisma.InputJsonValue {
  const payload: Record<string, unknown> = {}
  const record = source as unknown as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue
    payload[String(key)] = value
  }
  return payload as Prisma.InputJsonObject
}

function computeDesignStudioReady(record: BatsonNormalizedRecord, category: ProductCategory): boolean {
  if (category === 'blank') {
    const blank = record as NormalizedBlank
    return (
      !!blank.itemTotalLengthIn &&
      Boolean(blank.power) &&
      Boolean(blank.action) &&
      !!blank.tipOD_mm &&
      !!blank.buttOD_mm
    )
  }
  if (category === 'guide') {
    const guide = record as NormalizedGuide
    return (
      !!guide.ringSize &&
      !!guide.height_mm &&
      Boolean(guide.frameMaterial) &&
      Boolean(guide.ringMaterial) &&
      Boolean(guide.frameFinish) &&
      Boolean(guide.footType)
    )
  }
  if (category === 'tipTop') {
    const tipTop = record as NormalizedTipTop
    return (
      !!tipTop.tubeSize &&
      !!tipTop.ringSize &&
      Boolean(tipTop.tipTopType) &&
      Boolean(tipTop.frameMaterial) &&
      Boolean(tipTop.ringMaterial) &&
      Boolean(tipTop.frameFinish)
    )
  }
  if (category === 'grip') {
    const grip = record as NormalizedGrip
    return (
      !!grip.itemLengthIn &&
      !!grip.insideDiameterIn &&
      !!grip.frontODIn &&
      !!grip.rearODIn &&
      Boolean(grip.profileShape) &&
      Boolean(grip.gripPosition)
    )
  }
  if (category === 'reelSeat') {
    const seat = record as NormalizedReelSeat
    return (
      !!seat.itemLengthIn &&
      !!seat.insideDiameterIn &&
      !!seat.bodyOutsideDiameterIn &&
      Boolean(seat.seatSize) &&
      Boolean(seat.seatOrientation) &&
      Boolean(seat.hardwareFinish)
    )
  }
  if (category === 'trim') {
    const trim = record as NormalizedTrim
    return !!trim.itemLengthIn && !!trim.insideDiameterIn && !!trim.outsideDiameterIn
  }
  if (category === 'endCap') {
    const cap = record as NormalizedEndCap
    const hasLength = !!cap.itemLengthIn || !!cap.endCapDepthIn
    return hasLength && !!cap.insideDiameterIn && !!cap.outsideDiameterIn && Boolean(cap.capStyle)
  }
  return false
}

function ensureImagesPayload(
  images: Prisma.InputJsonValue | null | undefined,
  fallback?: string | null,
): Prisma.InputJsonValue | null {
  if (images && Array.isArray(images) && images.length > 0) return images
  if (fallback && fallback.trim().length) return [fallback]
  return null
}
