// hq-importer-new-import-v2
// Shared zero-config label mapper: normalizes labels, applies aliases, and matches to template fields

export type TemplateFieldMeta = {
  key: string
  label: string
  required?: boolean
}

export type AxesMap = { o1?: string; o2?: string; o3?: string }

export type AliasMemory = Array<{ label: string; fieldKey: string; source?: 'auto' | 'manual'; confidence?: number }>

export type MapInput = {
  attributes: Record<string, string | string[]>
  core: { sku?: string | null; price?: number | null; title?: string | null; availability?: string | null }
  axes?: AxesMap
}

export type MapResult = {
  fieldValues: Record<string, string | number | null>
  mappedFrom: Record<string, string> // templateFieldKey -> source label or core path
  unmatched: Array<{ label: string; sample: string | null }>
  axes: AxesMap
}

// Normalization: lowercase, trim, collapse spaces, strip punctuation, remove unit hints in parentheses, decode basic entities
export function normalizeLabel(label: string): string {
  if (!label) return ''
  const entities: Record<string, string> = { '&amp;': '&', '&#39;': "'", '&quot;': '"' }
  let s = String(label).trim()
  s = s.replace(/(&amp;|&#39;|&quot;)/g, m => entities[m] || m)
  s = s.replace(/\s+/g, ' ')
  // remove unit hints like (in), (lbs.), (oz.)
  s = s.replace(/\([^)]*\b(?:in|inch|inches|lbs?\.?|oz\.?|mm|cm)\b[^)]*\)/gi, '')
  s = s.replace(/[:。؛،．]*$/u, '')
  s = s.toLowerCase().trim()
  return s
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function valueOf(v: string | string[] | undefined): string | null {
  const arr = toArray(v)
  return arr.length ? String(arr[0]).trim() : null
}

// Build quick lookup for template fields by normalized label and by normalized suffix (key minus template prefix)
function indexTemplateFields(fields: TemplateFieldMeta[]): {
  byLabel: Map<string, TemplateFieldMeta>
  bySuffix: Map<string, TemplateFieldMeta>
  prefix?: string
} {
  const byLabel = new Map<string, TemplateFieldMeta>()
  const bySuffix = new Map<string, TemplateFieldMeta>()
  if (!fields.length) return { byLabel, bySuffix }
  // Guess common prefix from first key (e.g., batson_blanks_length)
  const first = fields[0]
  const p = first.key.includes('_') ? first.key.split('_')[0] : undefined
  const prefix = p ? p : undefined
  for (const f of fields) {
    byLabel.set(normalizeLabel(f.label), f)
    const keyNorm = normalizeLabel(f.key)
    const suf = prefix && keyNorm.startsWith(prefix + '_') ? keyNorm.slice(prefix.length + 1) : keyNorm
    bySuffix.set(suf, f)
  }
  return { byLabel, bySuffix, prefix }
}

// Global short aliases handled uniformly
const globalAliases: Array<[string, string]> = [
  ['tip top size', 'tip top'],
  ['rod blank color', 'blank color'],
  ['number of pieces', 'pieces'],
  ['product code', 'model'],
]

function applyGlobalAliases(label: string): string {
  const n = normalizeLabel(label)
  for (const [a, b] of globalAliases) {
    if (n === normalizeLabel(a)) return normalizeLabel(b)
  }
  return n
}

export function mapAttributesToTemplate(
  templateFields: TemplateFieldMeta[],
  input: MapInput,
  aliasMemory: AliasMemory = [],
): MapResult {
  const { byLabel, bySuffix } = indexTemplateFields(templateFields)
  const fieldValues: Record<string, string | number | null> = {}
  const mappedFrom: Record<string, string> = {}
  const unmatched: Array<{ label: string; sample: string | null }> = []

  const core = input.core || {}
  const axes: AxesMap = { ...input.axes }

  // 1) Try known cores
  for (const f of templateFields) {
    const keyN = normalizeLabel(f.key)
    const matchSku = keyN.endsWith('primary_variant_sku')
    const matchPrice = keyN.endsWith('primary_variant_price')
    if (matchSku && core.sku) {
      fieldValues[f.key] = core.sku
      mappedFrom[f.key] = 'core:sku'
    } else if (matchPrice && (core.price ?? null) !== null) {
      fieldValues[f.key] = core.price as number
      mappedFrom[f.key] = 'core:price'
    }
  }

  // 2) Build attribute candidates (normalized label -> value)
  const attrs: Array<{ norm: string; raw: string; value: string | null }> = []
  for (const [rawLabel, rawVal] of Object.entries(input.attributes || {})) {
    const val = valueOf(rawVal)
    if (val == null || String(val).trim() === '') continue
    const norm = applyGlobalAliases(rawLabel)
    attrs.push({ norm, raw: rawLabel, value: val })
  }

  // 3) Preload manual/auto alias memory as direct mappings
  const aliasMap = new Map<string, string>() // labelNorm -> fieldKey
  for (const a of aliasMemory) aliasMap.set(normalizeLabel(a.label), a.fieldKey)

  for (const at of attrs) {
    const aliasKey = aliasMap.get(at.norm)
    if (aliasKey) {
      fieldValues[aliasKey] = at.value
      mappedFrom[aliasKey] = at.raw
      continue
    }
    // exact match by template label
    const fByLabel = byLabel.get(at.norm)
    if (fByLabel) {
      fieldValues[fByLabel.key] = at.value
      mappedFrom[fByLabel.key] = at.raw
      continue
    }
    // match by suffix (key without prefix)
    const fBySuf = bySuffix.get(at.norm)
    if (fBySuf) {
      fieldValues[fBySuf.key] = at.value
      mappedFrom[fBySuf.key] = at.raw
      continue
    }
    // try removing common unit hints from norm again (already stripped, but extra safety with punctuation removal)
    const relaxed = normalizeLabel(
      at.norm
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .trim(),
    )
    if (relaxed !== at.norm) {
      const fRelax = byLabel.get(relaxed) || bySuffix.get(relaxed)
      if (fRelax) {
        fieldValues[fRelax.key] = at.value
        mappedFrom[fRelax.key] = at.raw
        continue
      }
    }
    // not mapped
    unmatched.push({ label: at.raw, sample: at.value })
  }

  // 4) Axes mapping from attributes (Length/Power/Action typical)
  const tryRead = (...keys: string[]): string | null => {
    for (const k of keys) {
      const n = applyGlobalAliases(k)
      // find attr by normalized label
      const hit = attrs.find(a => a.norm === n)
      if (hit?.value) return hit.value
    }
    return null
  }
  const ax1 = tryRead('item length in', 'length')
  const ax2 = tryRead('power')
  const ax3 = tryRead('action')
  axes.o1 = axes.o1 ?? (ax1 || undefined)
  axes.o2 = axes.o2 ?? (ax2 || undefined)
  axes.o3 = axes.o3 ?? (ax3 || undefined)

  return { fieldValues, mappedFrom, unmatched, axes }
}
