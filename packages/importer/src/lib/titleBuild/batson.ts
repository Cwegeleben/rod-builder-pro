// Title builder for Batson components.
// Supports blanks, guides, tip tops, guide kits, reel seats, grips, end caps/gimbals, and trim pieces.
// Uses heuristics based on normalized specs and falls back to legacy blank-centric ordering.

import { normalizeTipTop, expandFrameMaterial, expandRingMaterial } from '../tipTop'

export type BatsonTitleInput = {
  title?: string
  rawSpecs?: Record<string, unknown>
  slug?: string
  partType?: string
}

type BatsonCategory = 'blank' | 'guide' | 'tip_top' | 'guide_kit' | 'seat' | 'grip' | 'end_cap' | 'trim' | 'unknown'

const BRAND_RULES: Array<{
  label: string
  needles: RegExp[]
  categories?: BatsonCategory[]
}> = [
  {
    label: 'RainShadow',
    needles: [/rainshadow/i, /immortal/i, /revelation/i, /eternity/i, /judge/i, /revpro/i, /recon/i],
    categories: ['blank', 'unknown'],
  },
  {
    label: 'Alps',
    needles: [/alps/i, /\bmxn\b/i, /\baes\b/i, /\baip\b/i, /\bfxn\b/i, /xpress|xns|hxns?/i],
  },
  {
    label: 'Forecast',
    needles: [/forecast/i, /\bfx\b/i, /\bspg\b/i],
  },
]

function clamp255(s: string) {
  return s.length > 255 ? s.slice(0, 255) : s
}

function toSingleLine(s: string) {
  return s
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatFeetInchesFromInches(inches: number): string {
  if (!Number.isFinite(inches) || inches <= 0) return ''
  const feet = Math.floor(inches / 12)
  const rem = Math.round(inches - feet * 12)
  return `${feet}'${rem}"`
}

function tryNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizePieces(v: unknown): string {
  const n = tryNumber(v)
  if (n == null || n <= 1) return ''
  return `${n}pc`
}

function normalizePower(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  const code = s.toUpperCase()
  if (/^(UL|L|ML|M|MH|H|XH|XXH)$/.test(code)) return code
  return s
}

function normalizeColor(v: unknown): string {
  if (v == null) return ''
  return String(v)
    .replace(/\bcolor\b$/i, '')
    .trim()
}

function tokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean)
}

const GENERIC_TOKENS = new Set(['blank', 'grip', 'seat', 'guide', 'kit', 'trim', 'cap', 'gimbal', 'tip', 'top'])

function dedupeAdjacent(prev: string, next: string): string {
  if (!prev) return next
  const a = tokens(prev)
  const b = tokens(next)
  if (!a.length || !b.length) return next
  let bi = 0
  let ai = a.length - 1
  while (bi < b.length && ai >= 0) {
    const prevToken = a[ai]
    if (!prevToken) break
    if (GENERIC_TOKENS.has(prevToken.toLowerCase())) {
      ai--
      continue
    }
    if (prevToken.toLowerCase() === b[bi].toLowerCase()) {
      bi++
      ai--
      continue
    }
    break
  }
  const trimmed = b.slice(bi).join(' ')
  return trimmed || next
}

const titleCase = (s: string): string =>
  s
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim()

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function describeFrameMaterial(value?: unknown): string {
  if (value == null) return ''
  const direct = expandFrameMaterial(String(value))
  if (direct) return direct
  const raw = String(value).trim()
  return raw ? titleCase(raw) : ''
}

function describeRingMaterial(value?: unknown): string {
  if (value == null) return ''
  const direct = expandRingMaterial(String(value))
  if (direct) return direct
  const raw = String(value).trim()
  return raw ? titleCase(raw) : ''
}

function formatDecimal(value: number): string {
  const fixed = value.toFixed(1)
  return fixed.replace(/\.0$/, '')
}

function detectCategory(specs: Record<string, unknown>, explicit?: string | null | undefined): BatsonCategory {
  const normalizedExplicit = (explicit || specs.partType || specs.part_type || '').toString().toLowerCase()
  if (specs.is_kit) return 'guide_kit'
  if (/tip/.test(normalizedExplicit)) return 'tip_top'
  if (/guide/.test(normalizedExplicit)) return 'guide'
  if (/seat/.test(normalizedExplicit)) return 'seat'
  if (/grip/.test(normalizedExplicit)) return 'grip'
  if (/gimbal|cap/.test(normalizedExplicit)) return 'end_cap'
  if (/trim|winding/.test(normalizedExplicit)) return 'trim'
  if (specs.tube_size || specs.ring_size || specs.frame_material) {
    return specs.tube_size && !specs.ring_size ? 'tip_top' : 'guide'
  }
  if (specs.seat_type || specs.overall_length || specs.bore_id) return 'seat'
  if (specs.grip_type || specs.inner_diameter || specs.outer_diameter) return 'grip'
  if (specs.inner_diameter && specs.outer_diameter && /cap|gimbal/i.test(String(specs.part_type || specs.partType))) {
    return 'end_cap'
  }
  if (specs.part_type && /trim|winding/i.test(String(specs.part_type))) return 'trim'
  if (specs.power || specs.length_in || specs.line_lb || specs.lure_oz) return 'blank'
  return 'unknown'
}

function collectSearchBlob(input: BatsonTitleInput, specs: Record<string, unknown>): string {
  const primary = [
    input.title,
    input.slug,
    input.partType,
    specs.brand,
    specs.series,
    specs.model,
    specs.collection,
    specs.partType,
    specs.part_type,
    specs.manufacturer,
    specs.externalId,
    specs.code,
    specs.sku,
  ]
  const allValues: string[] = []
  for (const value of primary) {
    if (typeof value === 'string' || typeof value === 'number') allValues.push(String(value))
  }
  for (const value of Object.values(specs)) {
    if (typeof value === 'string' || typeof value === 'number') allValues.push(String(value))
    else if (Array.isArray(value)) allValues.push(value.filter(v => typeof v === 'string').join(' '))
  }
  return allValues.join(' ')
}

function detectBrandToken(input: BatsonTitleInput, specs: Record<string, unknown>, category?: BatsonCategory): string {
  const blob = collectSearchBlob(input, specs).toLowerCase()
  for (const rule of BRAND_RULES) {
    if (rule.categories && category && !rule.categories.includes(category)) continue
    if (rule.needles.some(rx => rx.test(blob))) return rule.label
  }
  return ''
}

function formatLineOrLure(label: string, value?: unknown, unit?: string): string {
  if (value == null) return ''
  let text = ''
  if (typeof value === 'string') text = value.trim()
  else if (Array.isArray(value)) text = value.filter(Boolean).join('-')
  else if (typeof value === 'number' && Number.isFinite(value)) text = value.toString()
  if (!text) return ''
  const sanitized = text.replace(/\s+/g, ' ').trim()
  return `${label} ${sanitized}${unit || ''}`.trim()
}

function formatMeasurement(label: string, value?: unknown, unitHint?: 'mm' | 'in'): string {
  if (value == null) return ''
  const num = tryNumber(value)
  if (num == null) {
    const s = String(value).trim()
    return s ? `${s} ${label}`.trim() : ''
  }
  let magnitude = ''
  if (unitHint === 'mm') magnitude = `${num}mm`
  else if (unitHint === 'in') magnitude = `${num}"`
  else magnitude = num >= 10 ? `${num}mm` : `${num}"`
  return `${magnitude} ${label}`.trim()
}

function buildGuideTitle(
  input: BatsonTitleInput,
  specs: Record<string, unknown>,
  category: Extract<BatsonCategory, 'guide' | 'tip_top' | 'guide_kit'>,
): string {
  const sx = specs as Record<string, unknown>
  const brandDisplay = detectBrandToken(input, specs, category)
  const isKit = category === 'guide_kit'
  const isTipTop = category === 'tip_top'
  const codeStr = (specs.externalId || specs.code || specs.sku || specs.model || '') as string
  let familyToken = ''
  if (codeStr) {
    const m = codeStr.match(/^[A-Z]{2,5}/)
    if (m) {
      const pref = m[0].toUpperCase()
      if (!/^(ALPS|FORE|BATSON)$/i.test(pref) && !(isKit && /^GK$/i.test(pref))) {
        if (/^(MXN|MXNL|AES|AHD|VTG|AIP|HXN|XN|TT|GX|FX|LX)$/i.test(pref)) familyToken = pref
        else if (pref.length >= 3) familyToken = pref
      }
    }
  }

  const ring =
    tryNumber(specs.ring_size) ??
    tryNumber(sx['ringSize']) ??
    tryNumber(sx['ring_diameter']) ??
    tryNumber(sx['ringDiameter'])
  const tube =
    tryNumber(specs.tube_size) ?? tryNumber(sx['tip_top_size']) ?? tryNumber(sx['tip_size']) ?? tryNumber(sx['tube'])
  const frame = (specs.frame_material || sx['frameMaterial'] || specs.frame || '') as string
  const finish = (specs.finish || specs.color || '') as string
  const ringMaterialRaw =
    (specs.ring_material as string | undefined) ||
    (sx['ringMaterial'] as string | undefined) ||
    (specs.ring_type as string | undefined) ||
    (sx['ringType'] as string | undefined) ||
    (sx['ring_material_type'] as string | undefined) ||
    (sx['ringMaterialType'] as string | undefined) ||
    (sx['insert'] as string | undefined) ||
    (sx['insertMaterial'] as string | undefined) ||
    ''
  const ringMaterialDisplay = describeRingMaterial(ringMaterialRaw)

  const guideParts: string[] = []
  if (brandDisplay) guideParts.push(brandDisplay)
  if (familyToken && !isKit) guideParts.push(familyToken)

  if (isKit) {
    const blob = (input.title || '') + ' ' + codeStr + ' ' + (specs.original_title || '')
    const kitType = /casting/i.test(blob)
      ? 'Casting'
      : /spinning|spin/i.test(blob)
        ? 'Spinning'
        : /conventional/i.test(blob)
          ? 'Conventional'
          : ''
    if (kitType) guideParts.push(kitType)
    const rawTitleConcat = (specs.original_title || '') + ' ' + (input.title || '') + ' ' + codeStr
    let guideCount = 0
    const dashPrefix = rawTitleConcat.trim().match(/^\s*(\d+(?:-\d+)+)/)
    if (dashPrefix) {
      guideCount = dashPrefix[1].split('-').filter(Boolean).length
    } else {
      const preBrand = rawTitleConcat.split(/\b(Alps|Forecast|Batson)\b/i)[0]
      const nums = (preBrand.match(/\b\d{1,2}\b/g) || []).map(n => parseInt(n, 10)).filter(n => n > 0 && n <= 50)
      if (nums.length) guideCount = nums.length
    }
    guideParts.push('Guide Kit')
    if (guideCount) guideParts.push(`(${guideCount} Guides)`)
  } else if (!isTipTop) {
    guideParts.push('Guide')
  }

  const finishDisplay = finish
    ? titleCase(
        String(finish)
          .replace(/finish|color/i, '')
          .trim(),
      )
    : ''
  const frameDisplay = describeFrameMaterial(frame)

  if (isTipTop) {
    const descriptionBlob = [
      input.title,
      (specs.original_title as string | undefined) || undefined,
      (specs.description as string | undefined) || undefined,
      (specs.series as string | undefined) || undefined,
    ]
      .filter(Boolean)
      .join(' ')
    const tipTop = normalizeTipTop({
      sku: codeStr,
      title: input.title,
      description: descriptionBlob,
      series: (specs.series as string | undefined) || undefined,
      family: familyToken || undefined,
      frameMaterial: frame,
      ringMaterial: ringMaterialRaw,
      tubeSize: specs.tube_size ?? sx['tip_top_size'] ?? sx['tip_size'] ?? sx['tube'],
      ringSize: specs.ring_size ?? sx['ringSize'] ?? sx['ring_diameter'] ?? sx['ringDiameter'],
    })
    return clamp255(toSingleLine(tipTop.title))
  }

  let descriptor = ''
  if (ring != null) {
    const ringSizeLabel = formatDecimal(ring)
    descriptor = `Ring ${ringSizeLabel}${finishDisplay ? ' ' + finishDisplay : ''}${frameDisplay ? ' - ' + frameDisplay + ' Frame' : ''}`
  } else if (tube != null) {
    const tubeVal = `Tube ${tube}${tube < 10 ? 'mm' : ''}`
    descriptor = `${tubeVal}${finishDisplay ? ' ' + finishDisplay : ''}${frameDisplay ? ' - ' + frameDisplay + ' Frame' : ''}`
  }
  if (descriptor) guideParts.push(descriptor)
  else {
    if (frameDisplay) guideParts.push(frameDisplay)
    if (finishDisplay) guideParts.push(finishDisplay)
  }
  return clamp255(toSingleLine(guideParts.filter(Boolean).join(' ')))
}

function buildSeatTitle(input: BatsonTitleInput, specs: Record<string, unknown>): string {
  const parts: string[] = []
  const brandToken = detectBrandToken(input, specs, 'seat')
  let series = toSingleLine(String(specs.series || specs.model || ''))
  if (brandToken && series) {
    const brandPrefix = new RegExp(`^${escapeRegExp(brandToken)}\\b`, 'i')
    if (brandPrefix.test(series)) {
      series = series
        .replace(brandPrefix, '')
        .replace(/^[\s-]+/, '')
        .trim()
    }
  }
  if (brandToken) parts.push(brandToken)
  if (series) parts.push(series)
  const seatType = titleCase(String(specs.seat_type || specs.partType || 'Reel Seat'))
  if (seatType) parts.push(seatType)
  const tubeSize = formatMeasurement('Tube', specs.tube_size ?? specs.bore_id ?? specs.size, 'mm')
  if (tubeSize) parts.push(tubeSize)
  const material = titleCase(String(specs.material || specs.material_family || ''))
  if (material) parts.push(material)
  const finish = titleCase(String(specs.finish || specs.color || ''))
  if (finish) parts.push(finish)
  parts.push('Reel Seat')
  return clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
}

function buildGripTitle(input: BatsonTitleInput, specs: Record<string, unknown>): string {
  const parts: string[] = []
  const brandToken = detectBrandToken(input, specs, 'grip')
  if (brandToken) parts.push(brandToken)
  const series = toSingleLine(String(specs.series || specs.model || ''))
  if (series) parts.push(series)
  const gripType = titleCase(String(specs.grip_type || specs.partType || 'Grip'))
  if (gripType) parts.push(gripType)
  const length = formatMeasurement('Length', specs.length ?? specs.length_in ?? specs.overall_length, 'in')
  if (length) parts.push(length)
  const id = formatMeasurement('ID', specs.inner_diameter ?? specs.id ?? specs.bore, 'in')
  if (id) parts.push(id)
  const od = formatMeasurement('OD', specs.outer_diameter ?? specs.od ?? specs.envelope_od, 'in')
  if (od) parts.push(od)
  const material = titleCase(String(specs.material || specs.material_family || ''))
  if (material) parts.push(material)
  const color = normalizeColor(specs.color || specs.finish)
  if (color) parts.push(color)
  parts.push('Grip')
  return clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
}

function buildEndCapTitle(input: BatsonTitleInput, specs: Record<string, unknown>): string {
  const parts: string[] = []
  const brandToken = detectBrandToken(input, specs, 'end_cap')
  if (brandToken) parts.push(brandToken)
  const series = toSingleLine(String(specs.series || specs.model || ''))
  if (series) parts.push(series)
  const partType = titleCase(String(specs.part_type || specs.partType || 'End Cap'))
  if (partType) parts.push(partType)
  const id = formatMeasurement('ID', specs.inner_diameter ?? specs.id, 'in')
  if (id) parts.push(id)
  const od = formatMeasurement('OD', specs.outer_diameter ?? specs.od, 'in')
  if (od) parts.push(od)
  const length = formatMeasurement('Length', specs.length ?? specs.height, 'in')
  if (length) parts.push(length)
  const material = titleCase(String(specs.material || specs.material_family || ''))
  if (material) parts.push(material)
  const color = normalizeColor(specs.color || specs.finish)
  if (color) parts.push(color)
  return clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
}

function buildTrimTitle(input: BatsonTitleInput, specs: Record<string, unknown>): string {
  const parts: string[] = []
  const brandToken = detectBrandToken(input, specs, 'trim')
  if (brandToken) parts.push(brandToken)
  const series = toSingleLine(String(specs.series || specs.model || ''))
  if (series) parts.push(series)
  const trimType = titleCase(String(specs.part_type || specs.partType || 'Trim'))
  if (trimType) parts.push(trimType)
  const id = formatMeasurement('ID', specs.inner_diameter ?? specs.id, 'in')
  if (id) parts.push(id)
  const od = formatMeasurement('OD', specs.outer_diameter ?? specs.od, 'in')
  if (od) parts.push(od)
  const thickness = formatMeasurement('Length', specs.thickness ?? specs.length, 'in')
  if (thickness) parts.push(thickness)
  const material = titleCase(String(specs.material || specs.material_family || ''))
  if (material) parts.push(material)
  const color = normalizeColor(specs.color || specs.finish)
  if (color) parts.push(color)
  parts.push('Trim')
  return clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
}

function detectBlankRole(specs: Record<string, unknown>, input?: BatsonTitleInput): string {
  const source = [
    specs.application,
    specs.series,
    specs.partType,
    specs.part_type,
    specs.slug,
    specs.collection,
    input?.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/fly/.test(source)) return 'Fly Blank'
  if (/surf/.test(source)) return 'Surf Blank'
  if (/spin|spinning/.test(source)) return 'Spinning Blank'
  if (/cast|casting|swimbait|swim/i.test(source)) return 'Casting Blank'
  if (/ice/.test(source)) return 'Ice Blank'
  return 'Blank'
}

function buildBlankTitle(input: BatsonTitleInput, specs: Record<string, unknown>): string {
  const parts: string[] = []
  const lenIn = tryNumber(specs.length_in ?? specs.length)
  if (lenIn != null) {
    const formatted = formatFeetInchesFromInches(lenIn)
    if (formatted) parts.push(formatted)
  }
  const pieces = normalizePieces(specs.pieces)
  if (pieces) parts.push(pieces)

  const brandToken = detectBrandToken(input, specs, 'blank')
  if (brandToken) parts.push(brandToken)

  const series = toSingleLine(String(specs.series || specs.collection || ''))
  if (series) parts.push(series)

  const role = detectBlankRole(specs, input)
  if (role) parts.push(role)

  const power = normalizePower(specs.power)
  if (power) parts.push(power)

  const action = specs.action ? titleCase(String(specs.action)) : ''
  if (action) parts.push(action)

  const lineRange = formatLineOrLure('Line', specs.line_lb || specs.line_rating, 'lb')
  if (lineRange) parts.push(lineRange)
  const lureRange = formatLineOrLure('Lure', specs.lure_oz || specs.lure_rating, ' oz')
  if (lureRange) parts.push(lureRange)

  const material = toSingleLine(String(specs.material || specs.material_family || ''))
  if (material) {
    const prevSnapshot = parts.filter(Boolean).join(' ')
    parts.push(dedupeAdjacent(prevSnapshot, material))
  }

  const color = normalizeColor(specs.color)
  if (color) parts.push(color)

  const title = clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
  if (title && !/^(page not found|product)$/i.test(title)) return title
  const fallback = toSingleLine(String(input.title || ''))
  return fallback
}

export function buildBatsonTitle(input: BatsonTitleInput): string {
  const specs = (input.rawSpecs || {}) as Record<string, unknown>
  const category = detectCategory(specs, input.partType)

  if (category === 'guide' || category === 'tip_top' || category === 'guide_kit') {
    const guideTitle = buildGuideTitle(input, specs, category)
    if (guideTitle) return guideTitle
  } else if (category === 'seat') {
    const seatTitle = buildSeatTitle(input, specs)
    if (seatTitle.trim().length > 3) return seatTitle
  } else if (category === 'grip') {
    const gripTitle = buildGripTitle(input, specs)
    if (gripTitle.trim().length > 3) return gripTitle
  } else if (category === 'end_cap') {
    const capTitle = buildEndCapTitle(input, specs)
    if (capTitle.trim().length > 3) return capTitle
  } else if (category === 'trim') {
    const trimTitle = buildTrimTitle(input, specs)
    if (trimTitle.trim().length > 3) return trimTitle
  } else if (category === 'blank' || category === 'unknown') {
    const blankTitle = buildBlankTitle(input, specs)
    if (blankTitle.trim().length > 3) return blankTitle
  }

  const fallbackTitle = buildBlankTitle(input, specs)
  if (fallbackTitle.trim().length > 3) return fallbackTitle
  return toSingleLine(String(input.title || ''))
}

export default buildBatsonTitle
