// Title builder for Batson components.
// Supports blanks, guides, tip tops, guide kits, reel seats, grips, end caps/gimbals, and trim pieces.
// Uses heuristics based on normalized specs and falls back to legacy blank-centric ordering.

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

const FRAME_MATERIAL_OVERRIDES: Record<string, string> = {
  SS: 'Stainless Steel',
  SS304: 'Stainless Steel (304)',
  SS304L: 'Stainless Steel (304L)',
  SS316: 'Stainless Steel (316)',
  SS316L: 'Stainless Steel (316L)',
  SS316TI: 'Stainless Steel (316Ti)',
  SS420: 'Stainless Steel (420)',
  STAINLESS: 'Stainless Steel',
  STAINLESSSTEEL: 'Stainless Steel',
  TITANIUM: 'Titanium',
  TITANIUMALLOY: 'Titanium Alloy',
  TITANIUMFRAME: 'Titanium',
  TI: 'Titanium',
  TITANIUMGR5: 'Titanium (Grade 5)',
  TITANIUMGRADE5: 'Titanium (Grade 5)',
  TITANIUMGRADE2: 'Titanium (Grade 2)',
  ALUMINUM: 'Aluminum',
  ALUMINIUM: 'Aluminum',
}

const RING_MATERIAL_DETAILS: Record<string, { label: string; short?: string }> = {
  SIC: { label: 'Silicon Carbide', short: 'SiC' },
  SICINSERT: { label: 'Silicon Carbide', short: 'SiC' },
  SILICONCARBIDE: { label: 'Silicon Carbide', short: 'SiC' },
  ALCONITE: { label: 'Alconite Ceramic' },
  ZIRCONIA: { label: 'Zirconia Ceramic' },
  ZIRCONIUM: { label: 'Zirconium Ceramic' },
  NANOLITE: { label: 'Nanolite Ceramic' },
  NANO: { label: 'Nano Ceramic' },
  NANOPLASMA: { label: 'Nano Plasma Ceramic' },
  ALUMINA: { label: 'Alumina Ceramic' },
  ALUMINUMOXIDE: { label: 'Aluminum Oxide Ceramic' },
  ALUMOXIDE: { label: 'Aluminum Oxide Ceramic' },
}

function describeFrameMaterial(value?: unknown): string {
  if (value == null) return ''
  const raw = String(value).replace(/frame/i, '').trim()
  if (!raw) return ''
  const compact = raw.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (FRAME_MATERIAL_OVERRIDES[compact]) return FRAME_MATERIAL_OVERRIDES[compact]
  const stainlessMatch = compact.match(/^S{1,2}(\d{3}[A-Z]?)$/)
  if (stainlessMatch) return `Stainless Steel (${stainlessMatch[1]})`
  if (compact.startsWith('STAINLESSSTEEL')) {
    const grade = compact.slice('STAINLESSSTEEL'.length)
    return grade ? `Stainless Steel (${grade})` : 'Stainless Steel'
  }
  return titleCase(raw)
}

function describeRingMaterial(value?: unknown): string {
  if (value == null) return ''
  const raw = String(value).replace(/ring/i, '').trim()
  if (!raw) return ''
  const compact = raw.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const detail = RING_MATERIAL_DETAILS[compact]
  if (detail) {
    return detail.short ? `${detail.label} (${detail.short})` : detail.label
  }
  if (/silicon\s*carbide/i.test(raw)) return 'Silicon Carbide (SiC)'
  if (/alum(in)?um\s*oxide/i.test(raw)) return 'Aluminum Oxide Ceramic'
  if (/ceramic/i.test(raw)) return titleCase(raw)
  const hasMixedCase = /[a-z]/.test(raw) && /[A-Z]/.test(raw)
  if (hasMixedCase) return raw
  if (/^[A-Z0-9]+$/.test(raw)) return raw
  return titleCase(raw)
}

function formatDecimal(value: number): string {
  const fixed = value.toFixed(1)
  return fixed.replace(/\.0$/, '')
}

function formatTipTopTube(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  const magnitude = formatDecimal(value)
  return `${magnitude}${value < 10 ? 'mm' : ''}`
}

const TIP_TYPE_DROP_WORDS = [
  'tip',
  'top',
  'tip top',
  'tip-top',
  'guide',
  'guides',
  'kit',
  'kits',
  'batson',
  'rainshadow',
  'alps',
  'forecast',
]

function sanitizeTipTypeCandidate(value: string): string {
  let text = value
  for (const word of TIP_TYPE_DROP_WORDS) {
    const rx = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi')
    text = text.replace(rx, ' ')
  }
  text = text.replace(/[#/]+/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  if (!text || text.length < 3) return ''
  return titleCase(text)
}

function deriveTipTopType(input: BatsonTitleInput, specs: Record<string, unknown>, brandDisplay: string): string {
  const brandPattern = brandDisplay ? new RegExp(`\\b${escapeRegExp(brandDisplay)}\\b`, 'i') : null
  const candidates: Array<unknown> = [
    (specs as Record<string, unknown>).tip_top_type,
    (specs as Record<string, unknown>).tipTopType,
    specs.tip_type,
    (specs as Record<string, unknown>).tipType,
    specs.tip_style,
    (specs as Record<string, unknown>).tipStyle,
    specs.tip_category,
    (specs as Record<string, unknown>).tipCategory,
    specs.style,
    specs.application,
    specs.series_type,
    (specs as Record<string, unknown>).seriesType,
    specs.series_style,
    (specs as Record<string, unknown>).seriesStyle,
    specs.part_subtype,
    (specs as Record<string, unknown>).partSubtype,
    specs.use_case,
    (specs as Record<string, unknown>).useCase,
    specs.type,
    specs.subtype,
  ]
  for (const source of candidates) {
    if (typeof source !== 'string') continue
    let candidate = source
    if (brandPattern) candidate = candidate.replace(brandPattern, '')
    candidate = candidate.replace(/tip[\s-]*top/gi, '').trim()
    const sanitized = sanitizeTipTypeCandidate(candidate)
    if (sanitized) return sanitized
  }
  const partType =
    typeof specs.part_type === 'string' ? specs.part_type : typeof specs.partType === 'string' ? specs.partType : ''
  if (partType) {
    const sanitized = sanitizeTipTypeCandidate(partType)
    if (sanitized) return sanitized
  }
  const titleCandidate = input.title || ''
  if (titleCandidate) {
    const match = titleCandidate.match(/([^\n]+?)\s+Tip[\s-]?Top/i)
    if (match) {
      let prefix = match[1]
      if (brandPattern) prefix = prefix.replace(brandPattern, '')
      const sanitized = sanitizeTipTypeCandidate(prefix)
      if (sanitized) return sanitized
    }
  }
  return 'Universal'
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
    specs.ring_material ||
    sx['ringMaterial'] ||
    specs.ring_type ||
    sx['ringType'] ||
    sx['ring_material_type'] ||
    sx['ringMaterialType'] ||
    sx['insert'] ||
    sx['insertMaterial'] ||
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
    const tipType = deriveTipTopType(input, specs, brandDisplay)
    const typeSegment = tipType ? `${tipType} Tip Top` : 'Tip Top'
    guideParts.push(typeSegment)
    const tubeDisplay = tube != null ? formatTipTopTube(tube) : ''
    const frameFinishSegment = [frameDisplay, finishDisplay].filter(Boolean).join(' ').trim()
    const leftDescriptor = [frameFinishSegment, tubeDisplay ? `${tubeDisplay} Tube` : '']
      .filter(Boolean)
      .join(' ')
      .trim()
    const ringSizeDisplay = ring != null ? formatDecimal(ring) : ''
    const ringSizeLabel = ringSizeDisplay ? `Size ${ringSizeDisplay}` : ''
    const ringDescriptorCore = [ringMaterialDisplay, ringSizeLabel].filter(Boolean).join(' ').trim()
    const ringDescriptor = ringDescriptorCore ? `${ringDescriptorCore} Ring` : ''
    const descriptorSections = [leftDescriptor, ringDescriptor].filter(Boolean)
    const descriptor = descriptorSections.join(' - ')
    if (descriptor) guideParts.push(descriptor)
    else {
      if (frameDisplay) guideParts.push(frameDisplay)
      if (finishDisplay) guideParts.push(finishDisplay)
    }
    return clamp255(toSingleLine(guideParts.filter(Boolean).join(' ')))
  }

  let descriptor = ''
  if (ring != null) {
    const ringSizeLabel = `Size ${formatDecimal(ring)}`
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
