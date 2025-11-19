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
import { inferReelSeatFamily, normalizeFinalTitle } from './batsonTitle'

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
  // Reel Seat specific (optional): size label + diameters
  size_label?: string
  inside_dia_in?: number
  hood_od_in?: number
  body_od_in?: number
  partType?: string
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
  // Distinguish formatting for Reel Seats vs Rod Blanks
  const partType = (src.partType || '').toLowerCase()
  const isReelSeat = /reel/.test(partType) || /seat/.test(partType)
  const series = (src.series || '').trim()
  if (isReelSeat) {
    // Desired format (friendly, SKU-less):
    //   <Brand?> <Family/Series?> <Material?> Reel Seat <Style?> Size <N> – <Color>
    const sizeRaw = (src.size_label || '').trim()
    const colorRaw = (src.color || '').trim()
    const color = capWords(colorRaw) || ''
    // seriesLower reserved for future heuristics if needed
    // Brand: prefer explicit Alps/Forecast (series/code), else fallback to Batson
    let brand = ''
    const code = (src.code || '').toUpperCase()
    if (
      /\balps\b/i.test(series) ||
      /^[A-Z]*AIP/.test(code) ||
      /^DALT/.test(code) ||
      /\bALPS\b/.test(code) ||
      /^ALPS[-_]/.test(code)
    )
      brand = 'Alps'
    else if (/\bforecast\b/i.test(series) || /\bFORECAST\b/.test(code) || /^FORECAST[-_]/.test(code)) brand = 'Forecast'
    else brand = 'Batson'
    // Family via centralized inference (code + series, slug not available here)
    const fam = inferReelSeatFamily({ code: src.code, series, slug: undefined }).family
    const family = fam || ''
    // Style and material/category
    let style = ''
    if (/dual\s*trigger/i.test(series)) style = 'Dual Trigger'
    // Suppress style when a family is present to avoid duplicates
    if (family) style = ''
    // Additionally, if brand fell back to Batson and no family was found, omit style per strict fallback format
    if (brand === 'Batson' && !family) style = ''
    let category = 'Reel Seat'
    if (/aluminum/i.test(series)) category = 'Aluminum Reel Seat'
    else if (/graphite/i.test(series)) category = 'Graphite Reel Seat'
    else if (/fly/i.test(series)) category = 'Fly Reel Seat'

    const baseParts: string[] = []
    if (brand) baseParts.push(brand)
    if (family) baseParts.push(family)
    baseParts.push(category)
    if (style) baseParts.push(style)
    // Append forced size label if present
    if (sizeRaw) baseParts.push(`Size ${sizeRaw}`)
    const parts = baseParts
    let title = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (color) title += ` – ${color}`
    let truncated = false
    if (title.length > MAX_TITLE_LEN) {
      title = title.slice(0, MAX_TITLE_LEN - 1).trimEnd() + '…'
      truncated = true
    }
    title = normalizeFinalTitle(title)
    return { title, parts, truncated }
  }
  // Rod Blank (unchanged ordering)
  const length = (src.length_label || toFeetIn(src.length_in) || '').trim()
  const power = capWords((src.power || '').trim()) || ''
  const material = (src.material || '').trim()
  const pieces = src.pieces && src.pieces > 1 ? `${src.pieces}pc` : ''
  const color = capWords((src.color || '').trim()) || ''
  // Per policy: omit model/SKU from rod blank titles as well
  const rawParts = [series, /* model */ '', length, power, material, pieces, color]
  const parts = rawParts.filter(p => !!p && p.trim())
  let title = parts.join(' ').replace(/\s+/g, ' ').trim()
  let truncated = false
  if (title.length > MAX_TITLE_LEN) {
    title = title.slice(0, MAX_TITLE_LEN - 1).trimEnd() + '…'
    truncated = true
  }
  title = normalizeFinalTitle(title)
  return { title, parts, truncated }
}

// Convenience for downstream usage – returns empty string if no parts.
export function buildBatsonTitle(src: TitleSource): string {
  return normalizeBatsonTitle(src).title
}
