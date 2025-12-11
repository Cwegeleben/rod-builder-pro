import {
  AvailabilityState,
  BatsonNormalizedRecord,
  BlankFamily,
  EndCapFamily,
  GuideFamily,
  GripFamily,
  NormalizedBlank,
  NormalizedEndCap,
  NormalizedGuide,
  NormalizedGrip,
  NormalizedReelSeat,
  NormalizedTipTop,
  NormalizedTrim,
  ReelSeatFamily,
  TipTopFamily,
  TrimFamily,
} from '../../domain/catalog/batsonNormalizedTypes'
import {
  normalizeTipTop,
  expandFrameMaterial,
  expandRingMaterial,
  getTipTopType,
} from '../../../packages/importer/src/lib/tipTop'

export type BatsonRawProduct = {
  externalId: string
  partType: string
  title: string
  description?: string
  rawSpecs: Record<string, unknown>
  availability?: string | null
  priceMsrp?: number | null
}

type UniversalOverrides = {
  material?: string
  series?: string
  brand?: string
}

type RangeUnits = 'lb' | 'oz'

const BRAND_RULES: Array<{ label: string; needles: RegExp[] }> = [
  {
    label: 'RainShadow',
    needles: [/rainshadow/i, /rx\d+/i, /immortal/i, /revelation/i, /eternity/i, /judge/i, /revpro/i],
  },
  { label: 'Alps', needles: [/alps/i, /mxn/i, /aes/i, /aip/i, /fxn/i, /hxns?/i] },
  { label: 'Forecast', needles: [/forecast/i, /spg/i, /fx\d/i, /winn/i] },
]

const DEFAULT_BRAND = 'Batson'

const availabilityMap: Record<string, AvailabilityState> = {
  instock: 'inStock',
  available: 'inStock',
  preorder: 'preorder',
  backorder: 'outOfStock',
  outofstock: 'outOfStock',
  discontinued: 'discontinued',
}

const numberFrom = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim()
    if (!cleaned) return undefined
    const match = cleaned.match(/(-?\d+(?:\.\d+)?)/)
    if (!match) return undefined
    const parsed = Number(match[1])
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const stringFrom = (specs: Record<string, unknown>, ...candidates: string[]): string | undefined => {
  for (const key of candidates) {
    const value = specs[key]
    if (value == null) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return undefined
}

const sanitizeSeries = (value?: string): string => value?.replace(/\s+/g, ' ').trim() || 'Batson'

const detectBrand = (input: BatsonRawProduct, specs: Record<string, unknown>): string => {
  const blob = [input.title, input.description, stringFrom(specs, 'series', 'collection', 'brand')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  for (const rule of BRAND_RULES) {
    if (rule.needles.some(rx => rx.test(blob))) return rule.label
  }
  return DEFAULT_BRAND
}

const normalizeAvailability = (value?: string | null): AvailabilityState | undefined => {
  if (!value) return undefined
  const normalized = value.toLowerCase().replace(/\s+/g, '')
  return availabilityMap[normalized]
}

const inchesToMm = (value?: number): number | undefined => {
  if (value == null) return undefined
  return Math.round(value * 25.4 * 100) / 100
}

const mmToInches = (value?: number): number | undefined => {
  if (value == null) return undefined
  return Math.round((value / 25.4) * 1000) / 1000
}

const formatRange = (value: unknown, unit: RangeUnits): string => {
  if (value == null) return ''
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim()
    return normalized ? normalized : ''
  }
  if (typeof value === 'number') return `${value} ${unit}`
  if (Array.isArray(value)) {
    const normalized = value
      .map(entry => (typeof entry === 'number' ? entry.toString() : String(entry)))
      .filter(Boolean)
    return normalized.join(' - ')
  }
  return ''
}

const splitList = (value?: string): string[] => {
  if (!value) return []
  return value
    .split(/[,/;|]/)
    .map(token => token.trim())
    .filter(Boolean)
}

const toApplications = (value?: string): string[] => {
  if (!value) return []
  return value
    .split(/[,/]/)
    .map(part => part.trim())
    .filter(Boolean)
}

const buildUniversal = <F extends string>(family: F, input: BatsonRawProduct, overrides: UniversalOverrides = {}) => {
  const specs = input.rawSpecs
  return {
    brand: overrides.brand || detectBrand(input, specs),
    series: sanitizeSeries(
      overrides.series || stringFrom(specs, 'series', 'collection', 'line', 'family', 'model') || input.title,
    ),
    family,
    material:
      overrides.material || stringFrom(specs, 'material', 'material_family', 'frame_material', 'insert') || 'Composite',
    productCode: input.externalId,
    msrp: input.priceMsrp ?? numberFrom(specs.msrp) ?? undefined,
    availability: normalizeAvailability(input.availability || stringFrom(specs, 'availability', 'catalog_status')),
    color: stringFrom(specs, 'color', 'finish'),
  }
}

const detectBlankFamily = (input: BatsonRawProduct): BlankFamily => {
  const blob =
    `${input.title} ${input.description || ''} ${stringFrom(input.rawSpecs, 'applications', 'series', 'line') || ''}`.toLowerCase()
  if (/center\s?pin/.test(blob)) return 'centerPinBlank'
  if (/fly/.test(blob)) return 'flyBlank'
  if (/ice/.test(blob)) return 'iceBlank'
  if (/surf/.test(blob)) return 'surfBlank'
  if (/salt|offshore|saltwater/.test(blob)) return 'saltwaterBlank'
  if (/glass/.test(blob)) return 'glassBlank'
  if (/composite|hybrid/.test(blob)) return 'compositeBlank'
  if (/troll/.test(blob)) return 'trollingBlank'
  if (/casting|mag\s?bass|mb\d/.test(blob)) return 'castingBlank'
  return 'spinningBlank'
}

const detectGuideFamily = (input: BatsonRawProduct): GuideFamily => {
  const specs = input.rawSpecs
  if (specs.is_kit || /\bkit\b/i.test(input.title)) return 'guideKit'
  const blob = `${input.title} ${input.description || ''}`.toLowerCase()
  if (/roller/.test(blob)) return 'rollerGuide'
  if (/micro/.test(blob)) return 'microGuide'
  if (/fly/.test(blob)) return 'flyGuide'
  if (/casting|boat/.test(blob)) return 'castingBoatGuide'
  if (/double|heavy/.test(blob)) return 'doubleFootGuide'
  return 'singleFootGuide'
}

const detectTipTopFamily = (input: BatsonRawProduct, type: string): TipTopFamily => {
  const blob = `${input.title} ${input.description || ''}`.toLowerCase()
  if (/roller/.test(blob)) return 'rollerTipTop'
  if (/fly/.test(blob)) return 'flyTipTop'
  if (/micro/.test(blob)) return 'microTipTop'
  if (/boat|offshore/.test(blob)) return 'boatTipTop'
  if (type === 'Heavy Duty') return 'castingTipTop'
  if (/spin/i.test(blob)) return 'spinningTipTop'
  return 'castingTipTop'
}

const detectGripFamily = (input: BatsonRawProduct): GripFamily => {
  const blob = `${input.title} ${stringFrom(input.rawSpecs, 'grip_type', 'profile') || ''}`.toLowerCase()
  if (/full\s?wells/.test(blob)) return 'fullWells'
  if (/half\s?wells/.test(blob)) return 'halfWells'
  if (/fighting/.test(blob)) return 'fightingButt'
  if (/switch|spey/.test(blob)) return 'switchGrip'
  if (/split/.test(blob) && /carbon/.test(blob)) return 'carbonSplitGrip'
  if (/carbon/.test(blob)) return 'carbonRearGrip'
  if (/rear/.test(blob)) return 'rearGrip'
  if (/fore/.test(blob)) return 'foreGrip'
  if (/ice/.test(blob)) return 'iceGrip'
  if (/winn/.test(blob)) return 'winnGrip'
  return 'splitGrip'
}

const detectSeatFamily = (input: BatsonRawProduct): ReelSeatFamily => {
  const blob = `${input.title} ${stringFrom(input.rawSpecs, 'seat_type', 'applications') || ''}`.toLowerCase()
  if (/fly/.test(blob)) return 'flySeat'
  if (/troll/.test(blob)) return 'trollingSeat'
  if (/salt|offshore/.test(blob)) return 'saltwaterSeat'
  if (/rail/.test(blob)) return 'railSeat'
  if (/ice/.test(blob)) return 'iceSeat'
  if (/casting|trigger/.test(blob)) return /trigger/.test(blob) ? 'triggerCastingSeat' : 'castingSeat'
  return 'spinningSeat'
}

const detectTrimFamily = (input: BatsonRawProduct): TrimFamily => {
  const blob = `${input.title} ${stringFrom(input.rawSpecs, 'part_type', 'trim_type') || ''}`.toLowerCase()
  if (/hook/.test(blob)) return 'hookKeeper'
  if (/winding/.test(blob)) return 'windingCheck'
  if (/lock/.test(blob)) return 'lockingRing'
  if (/pipe/.test(blob)) return 'pipeExtension'
  if (/carbon/.test(blob)) return 'carbonTube'
  if (/butt wrap/.test(blob)) return 'buttWrap'
  if (/trim ring/.test(blob) || /trim/.test(blob)) return 'trimRing'
  return 'decorativeTrim'
}

const detectEndCapFamily = (input: BatsonRawProduct): EndCapFamily => {
  const blob = `${input.title} ${stringFrom(input.rawSpecs, 'part_type') || ''}`.toLowerCase()
  if (/gimbal/.test(blob)) return 'gimbal'
  if (/fighting/.test(blob)) return 'fightingButtCap'
  if (/carbon/.test(blob)) return 'carbonButtCap'
  if (/aluminum/.test(blob)) return 'aluminumCap'
  if (/pvc/.test(blob)) return 'pvcCap'
  if (/eva/.test(blob)) return 'evaCap'
  if (/rubber/.test(blob)) return 'rubberCap'
  return 'buttCap'
}

const detectSeatOrientation = (input: BatsonRawProduct): 'upLock' | 'downLock' | 'trigger' | 'pistol' => {
  const blob = `${input.title} ${stringFrom(input.rawSpecs, 'seat_type') || ''}`.toLowerCase()
  if (/downlock/.test(blob)) return 'downLock'
  if (/trigger/.test(blob)) return 'trigger'
  if (/pistol/.test(blob)) return 'pistol'
  return 'upLock'
}

const ensureNumber = (value: number | undefined, fallback = 0): number => (value == null ? fallback : value)

export function normalizeBatsonBlank(input: BatsonRawProduct): NormalizedBlank {
  const specs = input.rawSpecs
  const family = detectBlankFamily(input)
  const base = buildUniversal(family, input)
  const itemTotalLengthIn = ensureNumber(numberFrom(specs.length_in) ?? numberFrom(specs.overall_length))
  const numberOfPieces = ensureNumber(numberFrom(specs.pieces), 1)
  const power = stringFrom(specs, 'power') || 'M'
  const action = stringFrom(specs, 'action') || 'F'
  const application = toApplications(stringFrom(specs, 'applications'))
  const blankType = stringFrom(specs, 'blank_type', 'part_type') || 'blank'
  const materialConstruction = stringFrom(specs, 'material', 'material_construction') || base.material
  const lineRating = formatRange(specs.line_lb, 'lb') || formatRange(stringFrom(specs, 'line_rating'), 'lb')
  const lureRating = formatRange(specs.lure_oz, 'oz') || formatRange(stringFrom(specs, 'lure_rating'), 'oz')
  const tipOD_mm = ensureNumber(numberFrom(specs.tip_top_size))
  const buttOD_mm = ensureNumber(inchesToMm(numberFrom(specs.butt_dia_in)) ?? numberFrom(specs.butt_dia_mm))
  const blankWeightOz = ensureNumber(numberFrom(specs.weight_oz))

  return {
    ...base,
    itemTotalLengthIn,
    numberOfPieces,
    power,
    action,
    application,
    blankType,
    materialConstruction,
    lineRating,
    lureRating,
    tipOD_mm,
    buttOD_mm,
    blankWeightOz,
    intrinsicPower_g: numberFrom(specs.intrinsic_power) ?? numberFrom(specs.ccs_ip_g),
    actionAngle_deg: numberFrom(specs.ccs_aa_deg) ?? numberFrom(specs.action_angle),
    ern: numberFrom(specs.ern),
    tenInDiameter_mm: numberFrom(specs.ten_in_dia) ?? inchesToMm(numberFrom(specs.ten_in_dia_in)),
    twentyInDiameter_mm: numberFrom(specs.twenty_in_dia) ?? inchesToMm(numberFrom(specs.twenty_in_dia_in)),
    thirtyInDiameter_mm: numberFrom(specs.thirty_in_dia) ?? inchesToMm(numberFrom(specs.thirty_in_dia_in)),
    finish: stringFrom(specs, 'finish'),
    notes: stringFrom(specs, 'notes'),
    suitableFor: application,
  }
}

export function normalizeBatsonGuide(input: BatsonRawProduct): NormalizedGuide {
  const specs = input.rawSpecs
  const family = detectGuideFamily(input)
  const frameMaterialCode = stringFrom(specs, 'frame_material')
  const ringMaterialCode = stringFrom(specs, 'ring_material', 'ring_type')
  const height_mm = ensureNumber(numberFrom(specs.height_mm) ?? inchesToMm(numberFrom(specs.height_in)))
  const weightOz = ensureNumber(numberFrom(specs.weight_oz) ?? numberFrom(specs.weight))

  return {
    ...buildUniversal(family, input, {
      material: frameMaterialCode ? expandFrameMaterial(frameMaterialCode) : undefined,
    }),
    frameMaterial: frameMaterialCode ? expandFrameMaterial(frameMaterialCode) : 'Unknown',
    frameMaterialCode: frameMaterialCode,
    frameFinish: stringFrom(specs, 'finish', 'frame_finish', 'color') || 'Standard',
    ringMaterial: ringMaterialCode ? expandRingMaterial(ringMaterialCode) : 'Unknown',
    ringMaterialCode: ringMaterialCode,
    ringSize: ensureNumber(numberFrom(specs.ring_size) ?? numberFrom(specs.ringDiameter)),
    tubeSize: numberFrom(specs.tube_size) ?? numberFrom(specs.tip_top_size) ?? undefined,
    footType: stringFrom(specs, 'foot_type') || (family === 'doubleFootGuide' ? 'double' : 'single'),
    height_mm,
    weightOz,
    footLength_mm: numberFrom(specs.foot_length_mm) ?? inchesToMm(numberFrom(specs.foot_length_in)),
    frameProfile: stringFrom(specs, 'frame_profile'),
    usageHints: stringFrom(specs, 'usage', 'applications'),
    kitContents: family === 'guideKit' ? splitList(stringFrom(specs, 'kit_breakdown', 'kit_contents')) : undefined,
  }
}

export function normalizeBatsonTipTop(input: BatsonRawProduct): NormalizedTipTop {
  const specs = input.rawSpecs
  const sku = input.externalId
  const tipTopType = getTipTopType({ sku, title: input.title, description: input.description })
  const normalized = normalizeTipTop({
    sku,
    title: input.title,
    description: input.description,
    frameMaterial: stringFrom(specs, 'frame_material'),
    ringMaterial: stringFrom(specs, 'ring_material'),
    tubeSize: specs.tube_size,
    ringSize: specs.ring_size,
    series: stringFrom(specs, 'series'),
  })
  const family = detectTipTopFamily(input, tipTopType)

  return {
    ...buildUniversal(family, input, {
      material: normalized.frameMaterialLong || expandFrameMaterial(normalized.frameMaterialCode || undefined),
    }),
    frameMaterial:
      normalized.frameMaterialLong || expandFrameMaterial(normalized.frameMaterialCode || undefined) || 'Unknown',
    frameMaterialCode: normalized.frameMaterialCode ?? undefined,
    frameFinish: stringFrom(specs, 'finish', 'frame_finish', 'color') || 'Standard',
    ringMaterial:
      normalized.ringMaterialLong || expandRingMaterial(normalized.ringMaterialCode || undefined) || 'Unknown',
    ringMaterialCode: normalized.ringMaterialCode ?? undefined,
    ringSize: ensureNumber(normalized.ringSizeNormalized ?? numberFrom(specs.ring_size)),
    tubeSize: ensureNumber(normalized.tubeSizeNormalized ?? numberFrom(specs.tube_size)),
    tipTopType: tipTopType as NormalizedTipTop['tipTopType'],
    displayName: normalized.title,
    weightOz: numberFrom(specs.weight_oz),
    height_mm: numberFrom(specs.height_mm) ?? inchesToMm(numberFrom(specs.height_in)),
    notes: stringFrom(specs, 'notes'),
    pricingTier: stringFrom(specs, 'pricing_tier'),
  }
}

export function normalizeBatsonGrip(input: BatsonRawProduct): NormalizedGrip {
  const specs = input.rawSpecs
  const family = detectGripFamily(input)
  return {
    ...buildUniversal(family, input),
    itemLengthIn: ensureNumber(numberFrom(specs.length_in) ?? numberFrom(specs.overall_length)),
    insideDiameterIn: ensureNumber(numberFrom(specs.inner_diameter) ?? numberFrom(specs.id_in)),
    frontODIn: ensureNumber(numberFrom(specs.front_od_in) ?? numberFrom(specs.od_front)),
    rearODIn: ensureNumber(
      numberFrom(specs.rear_od_in) ?? numberFrom(specs.od_rear) ?? numberFrom(specs.outer_diameter),
    ),
    profileShape: stringFrom(specs, 'grip_type', 'profile', 'shape') || 'straight',
    weight_g: numberFrom(specs.weight_g) ?? numberFrom(specs.weight),
    urethaneFilled: stringFrom(specs, 'urethane_filled') === 'yes',
    winnPattern: stringFrom(specs, 'winn_pattern'),
    texture: stringFrom(specs, 'texture'),
    notes: stringFrom(specs, 'notes'),
  }
}

export function normalizeBatsonReelSeat(input: BatsonRawProduct): NormalizedReelSeat {
  const specs = input.rawSpecs
  const family = detectSeatFamily(input)
  const hoodOdIn = numberFrom(specs.hood_od_in)
  const hoodOdMm = numberFrom(specs.hood_od_mm)
  return {
    ...buildUniversal(family, input),
    seatSize: stringFrom(specs, 'seat_size', 'size', 'designation') || '16',
    itemLengthIn: ensureNumber(numberFrom(specs.length_in) ?? numberFrom(specs.overall_length)),
    insideDiameterIn: ensureNumber(
      numberFrom(specs.inside_diameter) ?? numberFrom(specs.bore_id) ?? numberFrom(specs.tube_size),
    ),
    bodyOutsideDiameterIn: ensureNumber(numberFrom(specs.body_od_in) ?? numberFrom(specs.outer_diameter)),
    seatOrientation: detectSeatOrientation(input),
    hoodOutsideDiameterIn: hoodOdIn ?? (hoodOdMm != null ? mmToInches(hoodOdMm) : undefined),
    insertMaterial: stringFrom(specs, 'insert_material'),
    threadSpec: stringFrom(specs, 'thread_spec'),
    hardwareFinish: stringFrom(specs, 'finish', 'hardware_finish'),
    weightOz: numberFrom(specs.weight_oz) ?? numberFrom(specs.weight),
  }
}

export function normalizeBatsonTrim(input: BatsonRawProduct): NormalizedTrim {
  const specs = input.rawSpecs
  const family = detectTrimFamily(input)
  return {
    ...buildUniversal(family, input),
    itemLengthIn: ensureNumber(numberFrom(specs.length_in) ?? numberFrom(specs.height_in)),
    insideDiameterIn: ensureNumber(numberFrom(specs.inside_diameter) ?? numberFrom(specs.id_in)),
    outsideDiameterIn: ensureNumber(numberFrom(specs.outer_diameter) ?? numberFrom(specs.od_in)),
    heightIn: numberFrom(specs.height_in),
    weightOz: numberFrom(specs.weight_oz) ?? numberFrom(specs.weight),
    plating: stringFrom(specs, 'plating'),
    pattern: stringFrom(specs, 'pattern'),
    notes: stringFrom(specs, 'notes'),
  }
}

export function normalizeBatsonEndCap(input: BatsonRawProduct): NormalizedEndCap {
  const specs = input.rawSpecs
  const family = detectEndCapFamily(input)
  return {
    ...buildUniversal(family, input),
    itemLengthIn: ensureNumber(numberFrom(specs.length_in) ?? numberFrom(specs.height_in)),
    insideDiameterIn: ensureNumber(numberFrom(specs.inside_diameter) ?? numberFrom(specs.id_in)),
    outsideDiameterIn: ensureNumber(numberFrom(specs.outer_diameter) ?? numberFrom(specs.od_in)),
    endCapDepthIn: numberFrom(specs.depth_in),
    weightOz: numberFrom(specs.weight_oz) ?? numberFrom(specs.weight),
    hardwareInterface: stringFrom(specs, 'interface', 'hardware'),
    notes: stringFrom(specs, 'notes'),
  }
}

export function normalizeBatsonProduct(input: BatsonRawProduct): BatsonNormalizedRecord | null {
  const type = (input.partType || '').toLowerCase()
  if (type.includes('blank')) return normalizeBatsonBlank(input)
  if (type.includes('tip')) return normalizeBatsonTipTop(input)
  if (type.includes('guide')) return normalizeBatsonGuide(input)
  if (type.includes('grip')) return normalizeBatsonGrip(input)
  if (type.includes('seat')) return normalizeBatsonReelSeat(input)
  if (type.includes('trim') || type.includes('decor')) return normalizeBatsonTrim(input)
  if (type.includes('cap') || type.includes('gimbal')) return normalizeBatsonEndCap(input)
  return null
}
