const EN_DASH = '\u2013'

export type TipTopType = 'Standard' | 'Heavy Duty' | 'Medium Duty' | 'Boat' | 'Fly' | 'Micro'

export type TipTopFamilyHint =
  | 'castingTipTop'
  | 'spinningTipTop'
  | 'flyTipTop'
  | 'rollerTipTop'
  | 'microTipTop'
  | 'boatTipTop'

export const FRAME_MATERIAL_MAP: Record<string, string> = {
  SS316: '316 Stainless Steel',
  SS304: '304 Stainless Steel',
  TI: 'Titanium',
  AL: 'Aluminum Alloy',
  SS: 'Stainless Steel',
}

export const RING_MATERIAL_MAP: Record<string, string> = {
  AL: 'Alconite',
  SIC: 'Silicon Carbide',
  TIZIR: 'Titanium Zirconia',
  HRA: 'Hardloy',
  ZR: 'Zirconia',
  LS: 'Light Stone',
}

const TIP_TOP_TYPE_MAP: Record<string, TipTopType> = {
  H: 'Heavy Duty',
  M: 'Medium Duty',
  B: 'Boat',
  U: 'Standard',
  F: 'Fly',
  Y: 'Micro',
}

const TIP_TOP_TYPE_TO_FAMILY: Record<TipTopType, TipTopFamilyHint> = {
  Standard: 'spinningTipTop',
  'Heavy Duty': 'castingTipTop',
  'Medium Duty': 'castingTipTop',
  Boat: 'boatTipTop',
  Fly: 'flyTipTop',
  Micro: 'microTipTop',
}

const LOOP_STYLE_LABEL: Record<TipTopType, string> = {
  Standard: 'standard',
  'Heavy Duty': 'heavy-duty',
  'Medium Duty': 'medium-duty',
  Boat: 'boat',
  Fly: 'fly',
  Micro: 'micro',
}

type TipTopContext = {
  sku?: string | null
  title?: string | null
  description?: string | null
  series?: string | null
  family?: string | null
}

export type TipTopNormalizationInput = TipTopContext & {
  frameMaterial?: string | null
  ringMaterial?: string | null
  tubeSize?: unknown
  ringSize?: unknown
}

export type NormalizedTipTopSpec = {
  tipTopType: TipTopType
  familyHint: TipTopFamilyHint
  loopStyle: string
  frameMaterialCode?: string | null
  frameMaterialLong?: string | null
  ringMaterialCode?: string | null
  ringMaterialLong?: string | null
  tubeSizeMm?: number | null
  ringSize?: number | null
  title: string
}

const TUBE_MIN = 1
const TUBE_MAX = 10

const titleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

const upper = (value: string): string => value.toUpperCase()

const sanitizeMaterialCode = (input?: string | null): string | null => {
  if (!input) return null
  const trimmed = input.replace(/frame|ring|insert/gi, '').trim()
  if (!trimmed) return null
  const compact = trimmed.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return compact || null
}

export function expandMaterial(code: string | null | undefined, map: Record<string, string>): string {
  if (!code) return ''
  const normalized = sanitizeMaterialCode(code)
  if (normalized && map[normalized]) return map[normalized]
  const fallback = code.trim()
  if (!fallback) return ''
  if (/^[a-z0-9]+$/i.test(fallback)) {
    return fallback.length <= 4 ? fallback.toUpperCase() : titleCase(fallback)
  }
  return titleCase(fallback)
}

export function expandFrameMaterial(code?: string | null): string {
  return expandMaterial(code, FRAME_MATERIAL_MAP)
}

export function expandRingMaterial(code?: string | null): string {
  return expandMaterial(code, RING_MATERIAL_MAP)
}

const contains = (needle: string, hay?: string | null): boolean => {
  if (!hay) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

const stripForecastPrefix = (value: string): string => {
  if (/^F(?=TT)/i.test(value)) return value.slice(1)
  return value
}

function typeFromSku(sku?: string | null): TipTopType | null {
  if (!sku) return null
  const trimmed = sku.trim()
  if (!trimmed) return null
  const normalized = stripForecastPrefix(trimmed.toUpperCase())
  const letters = normalized.replace(/[^A-Z]/g, '')
  if (!letters) return null
  const candidate = letters.charAt(0)
  return TIP_TOP_TYPE_MAP[candidate] || null
}

const textBasedType = (ctx: TipTopContext): TipTopType | null => {
  const blob = [ctx.description, ctx.title, ctx.series, ctx.family]
    .filter(Boolean)
    .map(part => part!.toLowerCase())
    .join(' ')
  if (!blob) return null
  if (blob.includes('boat top')) return 'Boat'
  if (blob.includes('heavy duty')) return 'Heavy Duty'
  if (blob.includes('medium duty')) return 'Medium Duty'
  if (blob.includes('fly')) return 'Fly'
  if (blob.includes('micro')) return 'Micro'
  return null
}

export function getTipTopType(ctx: TipTopContext): TipTopType {
  const fromSku = typeFromSku(ctx.sku)
  if (fromSku) return fromSku
  const fromText = textBasedType(ctx)
  if (fromText) return fromText
  return 'Standard'
}

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed.replace(/[^0-9.]/g, ''))
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

const clampTube = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = Math.round(value * 10) / 10
  if (rounded < TUBE_MIN || rounded > TUBE_MAX) return null
  return rounded
}

const tubeFromSku = (sku?: string | null): number | null => {
  if (!sku) return null
  const upperSku = sku.toUpperCase()
  const ttMatch = upperSku.match(/TT(\d{1,2}(?:\.\d)?)/)
  if (ttMatch) return clampTube(Number(ttMatch[1]))
  const generic = upperSku.match(/(\d{1,2}(?:\.\d)?)(?=[A-Z-])/)
  if (generic) return clampTube(Number(generic[1]))
  return null
}

const tubeFromText = (text?: string | null): number | null => {
  if (!text) return null
  const match = text.match(/(\d{1,2}(?:\.\d)?)\s*(?:mm|tube)/i)
  if (!match) return null
  return clampTube(Number(match[1]))
}

const ringFromSku = (sku?: string | null): number | null => {
  if (!sku) return null
  const match = sku.match(/-(\d{1,2})(?=[A-Z]?)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const ringFromText = (text?: string | null): number | null => {
  if (!text) return null
  const match = text.match(/(\d{1,2})\s*(?:ring|size)/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const formatTubeDisplay = (value?: number | null): string => {
  if (value == null) return ''
  return value.toFixed(1)
}

export function normalizeTipTop(input: TipTopNormalizationInput): NormalizedTipTopSpec {
  const tipTopType = getTipTopType(input)
  const familyHint = TIP_TOP_TYPE_TO_FAMILY[tipTopType]
  const frameMaterialCode = sanitizeMaterialCode(input.frameMaterial) || input.frameMaterial || null
  const ringMaterialCode = sanitizeMaterialCode(input.ringMaterial) || input.ringMaterial || null
  const frameMaterialLong = expandFrameMaterial(frameMaterialCode || undefined)
  const ringMaterialLong = expandRingMaterial(ringMaterialCode || undefined)

  const tubeCandidates: Array<number | null> = [
    clampTube(parseNumber(input.tubeSize)),
    tubeFromSku(input.sku),
    tubeFromText(input.description),
    tubeFromText(input.title),
  ]
  const tubeSizeMm = tubeCandidates.find(value => value != null) ?? null

  const ringCandidates: Array<number | null> = [
    parseNumber(input.ringSize),
    ringFromSku(input.sku),
    ringFromText(input.description),
    ringFromText(input.title),
  ]
  const ringSize = ringCandidates.find(value => value != null) ?? null

  const tubeDisplay = formatTubeDisplay(tubeSizeMm)
  const ringDisplay = ringSize != null ? Math.round(ringSize).toString() : ''

  const leftParts = [`${tipTopType} Tip Top`, frameMaterialLong, tubeDisplay ? `${tubeDisplay} Tube` : ''].filter(
    Boolean,
  )
  const leftLabel = leftParts.join(' ').replace(/\s+/g, ' ').trim()

  const rightParts = [ringMaterialLong, ringDisplay ? `${ringDisplay} Ring` : ''].filter(Boolean)
  const rightLabel = rightParts.join(' ').replace(/\s+/g, ' ').trim()
  const title = rightLabel ? `${leftLabel} ${EN_DASH} ${rightLabel}` : leftLabel

  return {
    tipTopType,
    familyHint,
    loopStyle: LOOP_STYLE_LABEL[tipTopType],
    frameMaterialCode,
    frameMaterialLong,
    ringMaterialCode,
    ringMaterialLong,
    tubeSizeMm,
    ringSize,
    title,
  }
}

export function extractTipTopReadinessContext(specs?: Record<string, unknown> | null): {
  tubeSize?: number | null
  ringSize?: number | null
} | null {
  if (!specs) return null
  const tipTop = (specs as Record<string, unknown>)['tipTop'] as Record<string, unknown> | undefined
  if (tipTop && typeof tipTop === 'object') {
    const tipTopRecord = tipTop as Record<string, unknown>
    return {
      tubeSize: parseNumber(
        tipTopRecord['tubeSizeMm'] ??
          tipTopRecord['tubeSize'] ??
          (specs as Record<string, unknown>)['tube_size'] ??
          (specs as Record<string, unknown>)['tubeSize'],
      ),
      ringSize: parseNumber(
        tipTopRecord['ringSize'] ??
          (specs as Record<string, unknown>)['ring_size'] ??
          (specs as Record<string, unknown>)['ringSize'],
      ),
    }
  }
  return {
    tubeSize: parseNumber(
      (specs as Record<string, unknown>)['tube_size'] ?? (specs as Record<string, unknown>)['tubeSize'],
    ),
    ringSize: parseNumber(
      (specs as Record<string, unknown>)['ring_size'] ?? (specs as Record<string, unknown>)['ringSize'],
    ),
  }
}
