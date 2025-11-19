/*
  Batson title normalization: types, parsers (lightweight heuristics), and pure builders
  - Rod blanks and reel seats/hardware
  - Deterministic, human-readable titles
  - No SKU/model codes in titles
*/

export type BatsonBlankSeriesContext = {
  brandName: string // e.g., Rainshadow
  seriesDisplayName: string // e.g., Revelation RX7 Spin Bass Walleye Freshwater
  seriesCore: string // e.g., Revelation RX7, RX6, RX7
  techniqueLabel: string // e.g., Downrigger, Spin Bass/Walleye, Inshore Popping, Surf
}

export type BatsonBlankRow = {
  modelCode: string
  lengthFtInRaw: string // e.g., 9'6" or 114" etc.; tolerate variants
  piecesRaw: string // e.g., 1, 2 pc, etc.
  powerRaw: string // e.g., UL, L, ML, M, MH, H, XH, or words
  actionRaw?: string
  lineLbRaw?: string
  finishOrColorRaw?: string
}

export type BatsonReelSeatCategoryContext = {
  brandFallback?: string // Alps, Forecast, etc.
  categoryType: 'Aluminum Reel Seat' | 'Graphite Reel Seat' | 'Fly Reel Seat' | 'Trolling Butt' | 'Reel Seat Hardware'
}

export type BatsonReelSeatRow = {
  rawName: string // listing title text
  brandRaw?: string // brand line on card
  codeRaw?: string // Code: A16BP-B
  specsRaw?: string[]
  // Derived/normalized fields (optional shortcuts when available from structured parse)
  familyName?: string
  seatStyle?: string // Trigger, Dual Trigger, Skeleton, Classic-Locking, etc.
  size?: string // normalized number string (e.g., 16)
  material?: string // Aluminum, Graphite, etc.
  finishColor?: string // Black, Satin Gray Titanium, etc.
  insertMaterial?: string
  isInsertOnly?: boolean
  // Optional context for inference
  slug?: string // detail URL or path slug (used for family detection)
  series?: string // visible series/heading text
  hardwareKind?:
    | 'Reel Seat Hood'
    | 'Reel Seat Trim Ring and Bottom Hood'
    | 'Reel Seat Extension Ring'
    | 'Reel Seat Locking Nut'
    | 'Reel Seat Shim'
}

// ---------- Normalization helpers ----------
export function capWords(s?: string | null): string | undefined {
  if (!s) return undefined
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function toFeetIn(inches: number | string | undefined): string | undefined {
  if (inches == null) return undefined
  const n = typeof inches === 'string' ? Number(String(inches).replace(/[^\d.]/g, '')) : inches
  if (!isFinite(n) || n <= 0) return undefined
  const feet = Math.floor(n / 12)
  const rem = Math.round(n - feet * 12)
  if (feet > 0 && rem > 0) return `${feet}'${rem}"`
  if (feet > 0) return `${feet}'`
  if (rem > 0) return `${rem}"`
  return undefined
}

export function normalizeSizeLabel(s?: string | null): string | undefined {
  if (!s) return undefined
  let v = String(s).trim()
  v = v.replace(/^#\s*/, '') // #16 -> 16
  v = v.replace(/^Size\s*/i, '')
  if (!v) return undefined
  return String(Number(v)) === v ? `Size ${v}` : `Size ${v}`
}

export function parseBrandShort(s?: string | null): string | undefined {
  if (!s) return undefined
  const t = s.trim()
  if (/^forecast/i.test(t)) return 'Forecast'
  if (/^alps/i.test(t)) return 'Alps'
  return capWords(t)
}

export function mapPowerCode(s?: string | null): string | undefined {
  if (!s) return undefined
  const t = s.trim().toUpperCase()
  const map: Record<string, string> = {
    UL: 'Ultra Light',
    L: 'Light',
    ML: 'Medium Light',
    M: 'Medium',
    MH: 'Medium Heavy',
    H: 'Heavy',
    XH: 'Extra Heavy',
  }
  return map[t] || capWords(s)
}

export function normalizePieces(s?: string | number | null): string | undefined {
  if (s == null) return undefined
  const n = typeof s === 'number' ? s : Number(String(s).replace(/[^\d]/g, ''))
  if (!isFinite(n) || n <= 0) return undefined
  return `${n} pc`
}

// ---------- Lightweight context parsers (best-effort heuristics) ----------
export function parseBatsonBlankSeriesContext(html: string): BatsonBlankSeriesContext {
  // Minimal heuristic: aim for sensible defaults; real extraction can improve over time
  const brandName = 'Rainshadow'
  const seriesDisplayName = extractBetween(html, /<h1[^>]*>(.*?)<\/h1>/i) || 'RX'
  const coreMatch = seriesDisplayName.match(/^(.*?\b(?:RX6|RX7|Revelation RX7)\b)/i)
  const seriesCore = (coreMatch ? coreMatch[1] : seriesDisplayName).trim()
  const techniqueLabel = seriesDisplayName
    .replace(seriesCore, '')
    .trim()
    .replace(/^[-–:\s]+/, '')
  return { brandName, seriesDisplayName, seriesCore, techniqueLabel }
}

export function parseBatsonReelSeatCategoryContext(html: string): BatsonReelSeatCategoryContext {
  const h1 = extractBetween(html, /<h1[^>]*>(.*?)<\/h1>/i) || ''
  const brandFallback = /alps/i.test(html) ? 'Alps' : /forecast/i.test(html) ? 'Forecast' : undefined
  let categoryType: BatsonReelSeatCategoryContext['categoryType'] = 'Reel Seat Hardware'
  if (/aluminum/i.test(h1)) categoryType = 'Aluminum Reel Seat'
  else if (/graphite/i.test(h1)) categoryType = 'Graphite Reel Seat'
  else if (/fly/i.test(h1)) categoryType = 'Fly Reel Seat'
  else if (/trolling/i.test(h1)) categoryType = 'Trolling Butt'
  return { brandFallback, categoryType }
}

function extractBetween(html: string, re: RegExp): string | undefined {
  const m = re.exec(html)
  if (!m) return undefined
  return m[1]?.replace(/<[^>]+>/g, '').trim()
}

// ---------- Centralized family detection ----------
type ReelSeatFamilyOverride = {
  family: string
  codePrefix?: string | string[]
  slugIncludes?: string[]
  seriesIncludes?: string[]
}

// Overrides (exceptions only). Order matters; first match wins
export const REEL_SEAT_FAMILY_OVERRIDES: ReelSeatFamilyOverride[] = [
  {
    family: 'Dual Trigger',
    codePrefix: ['DALT'],
    seriesIncludes: ['dual trigger'],
  },
  {
    family: 'AIP Contour',
    codePrefix: ['AIP'],
    slugIncludes: ['aip-contour'],
    seriesIncludes: ['aip contour'],
  },
  // Common Batson/ALPS families inferred from code prefixes or slugs
  { family: 'AES Exposed Spin', codePrefix: ['AES'], seriesIncludes: ['exposed spin'] },
  { family: 'AHD Machined Aluminum', codePrefix: ['AHD'], seriesIncludes: ['machined aluminum'] },
  { family: 'Aluminum Trigger', codePrefix: ['AT'], seriesIncludes: ['aluminum trigger', 'trigger'] },
  // VTG Soft Touch: prefer generic family label without "Spin" to avoid redundant style tokens in title
  { family: 'VTG Soft Touch', codePrefix: ['VTG'], seriesIncludes: ['soft touch spin', 'vtg spin'] },
  { family: 'Centra Lock', slugIncludes: ['centra-lock'], seriesIncludes: ['centra lock'] },
  { family: 'Trolling Butt', slugIncludes: ['trolling-butt'], seriesIncludes: ['trolling butt'] },
  { family: 'Epic Butt', slugIncludes: ['epic-butt'], seriesIncludes: ['epic butt'] },
  { family: 'Terminator Trolling Butt', slugIncludes: ['terminator'], seriesIncludes: ['terminator'] },
]

export function inferReelSeatFamilyGeneric(args: {
  brand?: string | null
  code?: string | null
  slug?: string | null
  series?: string | null
  pageTitle?: string | null
}): { family: string | null } {
  // Build candidate strings
  const cand: string[] = []
  if (args.series) cand.push(args.series)
  if (args.pageTitle) cand.push(args.pageTitle)
  if (args.slug) {
    const rawSlug = String(args.slug)
    const onlyPath = rawSlug.replace(/^https?:\/\/[^/]+/i, '')
    cand.push(onlyPath.split(/[/]/).filter(Boolean).join(' '))
  }
  // Strip common junk like javascript:void(0)
  for (let i = 0; i < cand.length; i++) {
    cand[i] = cand[i]
      .replace(/javascript\s*:\s*void\s*\(\s*0\s*\)\s*;?/gi, ' ')
      .replace(/void\s*\(\s*0\s*\)/gi, ' ')
      .replace(/:\s*void\b/gi, ' ')
  }
  // Track tokens that appeared as ALL-CAPS acronyms in any original candidate text
  const upperAcronyms = new Set<string>()
  for (const c of cand) {
    const parts = String(c)
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
    for (const p of parts) {
      if (/^[A-Z]{2,5}$/.test(p)) {
        upperAcronyms.add(p.toLowerCase())
      }
    }
  }
  const raw = cand.join(' ').toLowerCase()
  // Normalize
  const s = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!s) return { family: null }
  // Remove brand and category noise, sizes/colors, and obvious code tokens
  const brandWords = ['alps', 'forecast', 'batson']
  const catWords = [
    'reel',
    'seat',
    'seats',
    'spin',
    'spinning',
    'casting',
    'fly',
    'trolling',
    'hardware',
    'insert',
    'skel',
    'skeleton',
    'recessed',
    'rec',
    'hood',
    'cap',
    'uplocking',
    'classic',
    'trigger',
    'dual',
    'contour',
    // common abbreviations seen in titles that should not become families
    'tr',
    // additional hardware/style noise tokens that should not become a family
    'dbl',
    'double',
    'locking',
    'lock',
    'nut',
    'nuts',
    'ring',
    'rings',
    'bottom',
    'trim',
    'extension',
    'shim',
    // descriptive style words that belong to style, not family
    'reverse',
    'angle',
    'long',
  ]
  const materialWords = [
    'aluminum',
    'alum',
    'graphite',
    'nylon',
    'titanium',
    'stainless',
    'steel',
    'carbon',
    'composite',
    'filled',
    'anodized',
  ]
  const filler = ['with', 'for', 'https', 'http', 'www', 'size']
  const colorWords = [
    'black',
    'matte',
    'matte black',
    'silver',
    'gloss',
    'gloss black',
    'shiny',
    'gunsmoke',
    'chrome',
    'brass',
    'gold',
    'nickel',
    'nickle',
    'dark',
    'ti',
    'satin',
  ]
  const tokens = s.split(/\s+/)
  // drop noise tokens
  let filtered = tokens
    .filter(t => !!t)
    // drop stray single-letter tokens like "r", "s", "w"
    .filter(t => t.length > 1)
    .filter(t => !brandWords.includes(t))
    .filter(t => !catWords.includes(t))
    .filter(t => !filler.includes(t))
    .filter(t => !/(?:javascript|void|null)/.test(t))
    .filter(t => !/^\d{1,3}$/.test(t)) // sizes
    .filter(t => !colorWords.includes(t))
    .filter(t => (/^[A-Z]{2,}\d[A-Z0-9-]*$/i.test(t) ? false : true)) // code-like
    // Drop mixed alpha-numeric tokens (e.g., ra8.5l2skc) commonly used as codes
    .filter(t => !(/[a-z][0-9]/i.test(t) || /[0-9][a-z]/i.test(t)))
    // Drop tokens containing punctuation that are likely junk
    .filter(t => !/[:;()]/.test(t))
    .filter(t => !materialWords.includes(t))
  // dedupe consecutive and global duplicates while preserving order
  filtered = filtered.filter((t, i, arr) => i === 0 || t !== arr[i - 1])
  filtered = filtered.filter((t, i) => filtered.indexOf(t) === i)
  const cleaned = filtered
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!cleaned) return { family: null }
  // Prefer longest sensible span up to ~4 words
  const words = cleaned.split(/\s+/).slice(0, 4)
  const toDisplayCase = (w: string) => {
    const lw = w.toLowerCase()
    // Preserve original ALL-CAPS acronyms (e.g., VTG, AIP) only if seen as such in source candidates
    if (upperAcronyms.has(lw)) return lw.toUpperCase()
    // Otherwise, regular Title Case
    return lw.charAt(0).toUpperCase() + lw.slice(1)
  }
  const family = words.map(toDisplayCase).join(' ')
  return { family: family || null }
}

export function inferReelSeatFamily(args: {
  brand?: string | null
  code?: string | null
  slug?: string | null
  series?: string | null
  pageTitle?: string | null
}): { family: string | null } {
  const code = (args.code || '').trim()
  const slugNorm = (args.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
  const seriesNorm = (args.series || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  for (const rule of REEL_SEAT_FAMILY_OVERRIDES) {
    // codePrefix startsWith (case-insensitive)
    if (rule.codePrefix) {
      const list = Array.isArray(rule.codePrefix) ? rule.codePrefix : [rule.codePrefix]
      const matched = list.some(p => code.toUpperCase().startsWith(String(p).toUpperCase()))
      if (matched) return { family: rule.family }
    }
    // slugIncludes substring
    if (slugNorm && rule.slugIncludes && rule.slugIncludes.some(s => slugNorm.includes(s.toLowerCase()))) {
      return { family: rule.family }
    }
    // seriesIncludes substring (normalized spacing)
    if (
      seriesNorm &&
      rule.seriesIncludes &&
      rule.seriesIncludes.some(s => seriesNorm.includes(s.toLowerCase().replace(/[_-]+/g, ' ')))
    ) {
      return { family: rule.family }
    }
  }
  // Fallback to generic inference
  return inferReelSeatFamilyGeneric(args)
}

// ---------- Builders ----------
export function buildBatsonBlankTitle(series: BatsonBlankSeriesContext, row: BatsonBlankRow): string {
  const brand = series.brandName || 'Rainshadow'
  const seriesCore = series.seriesCore || series.seriesDisplayName || ''
  const length = normalizeLength(row.lengthFtInRaw) || ''
  const pieces = normalizePieces(row.piecesRaw) || ''
  const power = mapPowerCode(row.powerRaw) || ''
  const action = row.actionRaw ? capWords(row.actionRaw) : undefined
  const technique = series.techniqueLabel ? capWords(series.techniqueLabel) : ''
  const finish = row.finishOrColorRaw ? capWords(row.finishOrColorRaw) : undefined

  const parts = [brand, seriesCore, length, pieces, power]
  if (action && action.length <= 12) parts.push(action)
  if (technique) parts.push(technique)
  parts.push('Rod Blank')
  let title = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (finish) title += ` – ${finish}`
  return normalizeFinalTitle(title)
}

function normalizeLength(val?: string): string | undefined {
  if (!val) return undefined
  const s = String(val)
  // If already in 6'8" form
  if (/\d+'\d+"/.test(s)) return s
  // If inches only
  const n = Number(s.replace(/[^\d.]/g, ''))
  return isFinite(n) && n > 0 ? toFeetIn(n) : undefined
}

export function buildBatsonReelSeatTitle(category: BatsonReelSeatCategoryContext, row: BatsonReelSeatRow): string {
  // Brand detection: prefer explicit hints, else default to Batson
  let brand = parseBrandShort(row.brandRaw) || category.brandFallback || ''
  if (!brand) {
    const series = row.series || row.rawName || ''
    if (/\bforecast\b/i.test(series)) brand = 'Forecast'
    else if (/\balps\b/i.test(series)) brand = 'Alps'
    else {
      // Additional hints from slug and code before falling back to Batson
      const slug = row.slug || ''
      const code = row.codeRaw || ''
      if (/\balps\b/i.test(slug) || /^[A-Z]*AIP/i.test(code) || /^DALT/i.test(code)) brand = 'Alps'
      else if (/\bforecast\b/i.test(slug)) brand = 'Forecast'
      else brand = 'Batson'
    }
  }
  // Prefer centralized inference; never use codeRaw directly to display family
  const inferred = inferReelSeatFamily({
    brand,
    code: row.codeRaw,
    slug: row.slug,
    series: row.series,
    pageTitle: row.rawName,
  })
  const inferredFamily = inferred.family || ''
  // Fallback to provided familyName if present and not code-like
  let familyRaw = inferredFamily || (row.familyName || '').trim()
  // Ensure brand tokens (e.g., Batson) are never treated as family
  if (/^batson$/i.test(familyRaw)) familyRaw = ''
  const family = isLikelyCode(familyRaw) ? '' : familyRaw
  // Brand already defaulted to Batson when undetected
  const size = normalizeSizeLabel(row.size) || undefined
  const material = row.material ? capWords(row.material) : undefined
  // Suppress style when a family is present to avoid duplicates like "Contour Contour".
  // Additionally, when brand fell back to Batson and no family was found, omit style to match strict fallback format.
  const computedStyle = row.seatStyle ? capWords(row.seatStyle) : undefined
  const style = family ? undefined : brand === 'Batson' ? undefined : computedStyle
  const finish = normalizeFinishColor(row.finishColor)

  // Hardware variants
  if (row.hardwareKind) {
    const parts = [brand, family, row.seatStyle ? capWords(row.seatStyle) : undefined, row.hardwareKind]
    let title = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (finish) title += ` – ${finish}`
    return normalizeFinalTitle(title)
  }

  // Insert-only path
  if (row.isInsertOnly) {
    const parts = [brand, family, 'Fly Reel Seat Insert']
    let title = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (row.insertMaterial) title += ` – ${capWords(row.insertMaterial)}`
    return normalizeFinalTitle(title)
  }

  // Core reel seats
  const pieces = [brand]
  if (family) pieces.push(family)
  if (material) pieces.push(material)
  if (style) pieces.push(style)
  pieces.push('Reel Seat')
  if (size) pieces.push(size)
  let title = pieces.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (finish) title += ` – ${finish}`
  return normalizeFinalTitle(title)
}

function isLikelyCode(token?: string | null): boolean {
  if (!token) return false
  const t = token.trim()
  if (!t) return false
  // Looks like ALPHA+digits without spaces (e.g., A16BP, GST20C, RA5)
  if (/^[A-Z]{1,}[A-Z0-9]*\d[A-Z0-9]*$/i.test(t)) return true
  // Short tokens with trailing digits (RA5) are also codes
  if (/^[A-Z]{2,}\d$/i.test(t)) return true
  return false
}

// Final title polish for UI friendliness
export function normalizeFinalTitle(input: string): string {
  let s = String(input || '')
  if (!s) return s
  // Minimal HTML entity decoding
  s = s
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
  // Collapse spaces around slashes (but keep spaces around en dash)
  // e.g., "R / S" -> "R/S", "W / Reel" -> "W/ Reel", "Regular / Curved" -> "Regular/Curved"
  s = s.replace(/\s*\/\s*/g, '/')
  // Ensure common shorthand "W/" keeps a trailing space when followed by a word, e.g., "W/Reel" -> "W/ Reel"
  s = s.replace(/\bW\/(?!\s)/g, 'W/ ')
  // Fix common trolling butt angles: (30 -> (30°) and (130 -> (130°)
  s = s.replace(/\((130)(?!°?\))/g, '($1°)')
  s = s.replace(/\((30)(?!°?\))/g, '($1°)')
  // Remove duplicate spaces
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}

// Normalize common Batson/ALPS finish and color labels to consistent display names
function normalizeFinishColor(val?: string | null): string | undefined {
  if (!val) return undefined
  let s = String(val).trim()
  if (!s) return undefined
  const lc = s.toLowerCase()
  const direct: Record<string, string> = {
    'shiney gunsmoke': 'Shiny Gunsmoke',
    'shiny gunsmoke': 'Shiny Gunsmoke',
    'ti chrome': 'Titanium Chrome',
    'titanium chrome': 'Titanium Chrome',
    'satin gray titanium': 'Satin Gray Titanium',
    'satin grey titanium': 'Satin Gray Titanium',
    'matte black': 'Matte Black',
    black: 'Black',
    silver: 'Silver',
    gold: 'Gold',
    brass: 'Brass',
    gunsmoke: 'Gunsmoke',
  }
  if (direct[lc]) return direct[lc]
  // Expand common shorthands
  s = s
    .replace(/\bshiney\b/gi, 'Shiny')
    .replace(/\bsgt\b/gi, 'Satin Gray Titanium')
    .replace(/\bsg\b/gi, 'Shiny Gunsmoke')
    .replace(/\bti\b/gi, 'Titanium')
    .replace(/\btich\b/gi, 'Titanium Chrome')
  return capWords(s)
}
