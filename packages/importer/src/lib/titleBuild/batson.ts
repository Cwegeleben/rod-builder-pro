// Title builder for Batson rod blanks
// - Order: length (feet'inches"), series, material, pieces (Npc; omit 1pc), power, color
// - Adjacency token dedupe across segment boundaries
// - Normalization: collapse spaces, clamp to 255, keep original casing except power codes

export type BatsonTitleInput = {
  title?: string
  rawSpecs?: Record<string, unknown>
}

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
  if (n == null) return ''
  if (n <= 1) return ''
  return `${n}pc`
}

function normalizePower(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  // If value is a simple code, force uppercase; else keep original casing
  const code = s.toUpperCase()
  if (/^(UL|L|ML|M|MH|H|XH|XXH)$/.test(code)) return code
  return s
}

function normalizeColor(v: unknown): string {
  if (v == null) return ''
  let s = String(v)
  s = s.replace(/\bcolor\b$/i, '').trim()
  return s
}

function tokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean)
}

function dedupeAdjacent(prev: string, next: string): string {
  if (!prev) return next
  const a = tokens(prev)
  const b = tokens(next)
  if (!a.length || !b.length) return next
  // If next begins with a sequence that repeats the ENTIRE tail of prev (e.g. 'Immortal RX8' + 'RX8 Graphite'),
  // drop only the overlapping prefix ('RX8'). We compare token by token against last tokens of prev.
  let i = 0
  while (i < b.length) {
    const ai = a[a.length - 1 - i]
    if (!ai) break
    if (ai.toLowerCase() === b[i].toLowerCase()) {
      i++
      continue
    }
    break
  }
  const trimmed = b.slice(i).join(' ')
  return trimmed || next
}

export function buildBatsonTitle(input: BatsonTitleInput): string {
  const specs = (input.rawSpecs || {}) as Record<string, unknown>
  const parts: string[] = []

  // 1) Length
  let lengthSeg = ''
  const lenIn = tryNumber(specs.length_in)
  if (lenIn != null) {
    lengthSeg = formatFeetInchesFromInches(lenIn)
  } else if (typeof specs.length === 'string' && specs.length.trim()) {
    // If a human-readable length is already present, use it
    lengthSeg = String(specs.length).trim()
  }
  if (lengthSeg) parts.push(toSingleLine(lengthSeg))

  // 2) Series
  const series = toSingleLine(String(specs.series || ''))
  if (series) parts.push(series)

  // 3) Material
  const material = toSingleLine(String(specs.material || ''))
  if (material) {
    const prev = parts[parts.length - 1] || ''
    const deduped = dedupeAdjacent(prev, material)
    parts.push(deduped)
  }

  // 4) Pieces
  const pieces = normalizePieces(specs.pieces)
  if (pieces) parts.push(pieces)

  // 5) Power
  const power = normalizePower(specs.power)
  if (power) parts.push(power)

  // 6) Color
  const color = normalizeColor(specs.color)
  if (color) parts.push(color)

  const title = clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
  return title || toSingleLine(String(input.title || ''))
}

export default buildBatsonTitle
