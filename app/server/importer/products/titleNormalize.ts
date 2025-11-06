/**
 * Build a normalized product title for Batson rod blanks.
 * Format: model + series + length + material + power + pieces + blank color
 * Rules:
 *  - Skip empty/undefined parts
 *  - model: prefer model, fallback to code
 *  - length: prefer length_label; else derive from length_in (inches -> F'I" form, omit inches if 0)
 *  - power: capitalize each word (Medium Heavy -> Medium Heavy); trim
 *  - pieces: include only if > 1 (e.g., 2pc)
 *  - color: capitalize words
 *  - Collapse extra whitespace; trim
 *  - Truncate >255 chars with an ellipsis … (Unicode U+2026)
 */
export type TitleSource = {
  code?: string
  model?: string
  series?: string
  length_label?: string
  length_in?: number
  material?: string
  power?: string
  pieces?: number
  color?: string
}

export type NormalizedTitleResult = {
  title: string
  parts: string[]
  truncated: boolean
}

const MAX_TITLE_LEN = 255

function toFeetIn(inches: number | undefined): string | undefined {
  if (inches == null || !Number.isFinite(inches) || inches <= 0) return undefined
  const feet = Math.floor(inches / 12)
  const rem = Math.round(inches - feet * 12)
  if (feet <= 0 && rem <= 0) return undefined
  if (feet > 0 && rem > 0) return `${feet}'${rem}"`
  if (feet > 0) return `${feet}'`
  return `${rem}"` // unlikely (length < 12)
}

function capWords(s: string | undefined): string | undefined {
  if (!s) return s
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function normalizeBatsonTitle(src: TitleSource): NormalizedTitleResult {
  const model = (src.model || src.code || '').trim()
  const series = (src.series || '').trim()
  const length = (src.length_label || toFeetIn(src.length_in) || '').trim()
  const material = (src.material || '').trim()
  const power = capWords((src.power || '').trim()) || ''
  const pieces = src.pieces && src.pieces > 1 ? `${src.pieces}pc` : ''
  const color = capWords((src.color || '').trim()) || ''

  const rawParts = [model, series, length, material, power, pieces, color]
  const parts = rawParts.filter(p => !!p)
  let title = parts.join(' ').replace(/\s+/g, ' ').trim()
  let truncated = false
  if (title.length > MAX_TITLE_LEN) {
    title = title.slice(0, MAX_TITLE_LEN - 1).trimEnd() + '…'
    truncated = true
  }
  return { title, parts, truncated }
}

// Convenience for downstream usage – returns empty string if no parts.
export function buildBatsonTitle(src: TitleSource): string {
  return normalizeBatsonTitle(src).title
}
