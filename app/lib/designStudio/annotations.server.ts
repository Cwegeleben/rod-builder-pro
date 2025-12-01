import crypto from 'node:crypto'

export type DesignStudioAnnotationInput = {
  supplierKey: string
  partType?: string | null
  title: string
  rawSpecs?: Record<string, unknown> | null
  normSpecs?: Record<string, unknown> | null
}

export type DesignStudioAnnotation = {
  ready: boolean
  family?: string | null
  series?: string | null
  role: string
  compatibility: {
    lengthIn?: number | null
    power?: string | null
    action?: string | null
    finish?: string | null
    rodPieces?: number | null
    categories: string[]
  }
  coverageNotes?: string | null
  sourceQuality?: string | null
  hash: string
}

export function normalizeDesignPartType(partType?: string | null): string | null {
  if (!partType) return null
  const trimmed = partType.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower.includes('blank')) return 'BLANK'
  if (lower.includes('guide set')) return 'GUIDE_SET'
  if (lower.includes('guide') && lower.includes('tip')) return 'GUIDE_TIP'
  if (lower.includes('guide')) return 'GUIDE'
  if (lower.includes('reel') && lower.includes('seat')) return 'REEL_SEAT'
  if (lower.includes('seat')) return 'SEAT'
  if (lower.includes('handle') || lower.includes('grip')) return 'HANDLE'
  if (lower.includes('butt')) return 'BUTT_CAP'
  if (lower.includes('kit')) return 'KIT'
  return (
    trimmed
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase() || null
  )
}

const SERIES_FAMILY_MAP: Array<{ pattern: RegExp; family: string }> = [
  { pattern: /eternity/i, family: 'Rainshadow Eternity' },
  { pattern: /revelation/i, family: 'Rainshadow Revelation' },
  { pattern: /immortal/i, family: 'Rainshadow Immortal' },
  { pattern: /revelation rx7|rx7/i, family: 'Rainshadow Revelation' },
  { pattern: /rx6/i, family: 'Rainshadow RX6' },
  { pattern: /rx7/i, family: 'Rainshadow RX7' },
]

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function pickString(specs: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = specs[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return undefined
}

function pickNumber(specs: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const val = specs[key]
    if (typeof val === 'number' && !Number.isNaN(val)) return val
    if (typeof val === 'string') {
      const parsed = Number(val.replace(/[^\d.-]/g, ''))
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return undefined
}

function deriveSeries(input: DesignStudioAnnotationInput, specs: Record<string, unknown>): string | undefined {
  const fromSpecs = pickString(specs, [
    'series',
    'series_name',
    'seriesName',
    'seriesLabel',
    'family',
    'lineup',
    'collection',
  ])
  if (fromSpecs) return fromSpecs
  const titleMatch = input.title.match(/([A-Z][A-Za-z]+\s?(?:RX6|RX7|[IVX]+)?)/)
  if (titleMatch) return titleMatch[1].trim()
  return undefined
}

function deriveFamily(series: string | undefined, supplierKey: string): string | undefined {
  if (!series) return undefined
  const direct = SERIES_FAMILY_MAP.find(rule => rule.pattern.test(series))
  if (direct) return direct.family
  if (/batson/i.test(supplierKey)) {
    if (/rainshadow/i.test(series)) return 'Rainshadow Custom'
    return `Batson ${series}`.trim()
  }
  return series
}

function deriveRole(partType: string | undefined | null): string {
  if (!partType) return 'component'
  const pt = partType.toLowerCase()
  if (pt.includes('blank')) return 'blank'
  if (pt.includes('guide') && pt.includes('set')) return 'guide_set'
  if (pt.includes('guide')) return 'guide'
  if (pt.includes('tip')) return 'guide_tip'
  if (pt.includes('seat')) return 'reel_seat'
  if (pt.includes('grip') || pt.includes('handle')) return 'handle'
  return 'component'
}

export function deriveDesignStudioAnnotations(input: DesignStudioAnnotationInput): DesignStudioAnnotation {
  const rawSpecs = asRecord(input.rawSpecs)
  const normSpecs = asRecord(input.normSpecs)
  const merged: Record<string, unknown> = { ...rawSpecs, ...normSpecs }

  const series = deriveSeries(input, merged)
  const family = deriveFamily(series, input.supplierKey)
  const role = deriveRole(input.partType)
  const lengthIn = pickNumber(merged, ['length_in', 'lengthIn', 'length_inches', 'length', 'lengthInches'])
  const power =
    pickString(merged, ['power', 'power_code', 'power_label']) ||
    (input.title.match(/\b(UL|L|ML|M|MH|H|XH|XXH)\b/i)?.[1].toUpperCase() ?? undefined)
  const action =
    pickString(merged, ['action', 'action_label']) ||
    (input.title.match(/\b(XF|F|MF|M|S|SF)\b/i)?.[1].toUpperCase() ?? undefined)
  const finish = pickString(merged, ['finish', 'frame_finish', 'color', 'colorway'])
  const rodPieces = pickNumber(merged, ['pieces', 'piece_count'])

  const missing: string[] = []
  if (!family) missing.push('family')
  if (role === 'blank' && !lengthIn) missing.push('length')
  if (role === 'blank' && !power) missing.push('power')

  const ready = missing.length === 0
  const coverageNotes = missing.length ? `Needs ${missing.join(', ')}` : undefined
  const sourceQuality = ready ? 'auto:complete' : 'auto:needs-review'

  const compatibility = {
    lengthIn: lengthIn ?? null,
    power: power ?? null,
    action: action ?? null,
    finish: finish ?? null,
    rodPieces: rodPieces ?? null,
    categories: Array.from(
      new Set(
        [role, input.partType?.toLowerCase() || '', series?.toLowerCase() || ''].map(s => s.trim()).filter(Boolean),
      ),
    ),
  }

  const hashPayload = {
    supplier: input.supplierKey,
    partType: input.partType || null,
    role,
    family: family || null,
    series: series || null,
    ready,
    compatibility,
  }
  const hash = crypto.createHash('sha1').update(JSON.stringify(hashPayload)).digest('hex')

  return { ready, family, series, role, compatibility, coverageNotes, sourceQuality, hash }
}
