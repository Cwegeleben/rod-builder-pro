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

  let baseTitle = clamp255(toSingleLine(parts.filter(Boolean).join(' ')))
  const placeholder = /^(page not found|product)$/i.test(baseTitle) || baseTitle.length < 3

  // Alternative construction for guides / tip tops / kits when blank-focused fields are absent
  const hasBlankSignals = Boolean(specs.length_in || specs.series || specs.power)
  const ring = tryNumber(specs.ring_size)
  const tube = tryNumber(specs.tube_size)
  const frame = (specs.frame_material || specs.frame || '') as string
  const finish = (specs.finish || specs.color || '') as string
  const isKit = Boolean(specs.is_kit)
  const brandToken = (() => {
    const raw = (input.title || '') + ' ' + Object.values(specs).join(' ')
    const lc = raw.toLowerCase()
    if (lc.includes('alps')) return 'Alps'
    if (lc.includes('forecast')) return 'Forecast'
    if (lc.includes('batson')) return 'Batson'
    return ''
  })()
  const codeStr = (specs.externalId || specs.code || '') as string
  // Family heuristics: leading alpha prefix (2-5 chars) from code when not a known brand or generic kit code
  let familyToken = ''
  if (codeStr) {
    const m = codeStr.match(/^[A-Z]{2,5}/)
    if (m) {
      const pref = m[0].toUpperCase()
      if (!/^(ALPS|FORE|BATSON)$/i.test(pref) && !(isKit && /^GK$/i.test(pref))) {
        // Allow common guide families (MXN, MXNL, AES, AHD, VTG, AIP, HXN, XN etc.)
        if (/^(MXN|MXNL|AES|AHD|VTG|AIP|HXN|XN|TT|GX|FX|LX)$/i.test(pref)) familyToken = pref
        else if (pref.length >= 3 && !/^(GK)$/i.test(pref)) familyToken = pref
      }
    }
  }

  if (!hasBlankSignals && (ring || tube || frame || finish || isKit)) {
    const guideParts: string[] = []
    let brandDisplay = brandToken ? brandToken.charAt(0).toUpperCase() + brandToken.slice(1).toLowerCase() : ''
    if (!brandDisplay) brandDisplay = 'Batson'
    guideParts.push(brandDisplay)
    if (familyToken) guideParts.push(familyToken)

    // Style tokens for kits (heavy/light/spinning/casting/conventional/turbo) from title or code
    const styleSource = (input.title || '') + ' ' + (specs.externalId || specs.code || '')
    const styleHits = Array.from(
      new Set(
        (styleSource.match(/\b(heavy|light|spinning|casting|conventional|turbo)\b/gi) || []).map(
          s => s[0].toUpperCase() + s.slice(1).toLowerCase(),
        ),
      ),
    )

    // Kit type detection (casting/spinning/conventional)
    const kitType = (() => {
      if (!isKit) return ''
      const blob = (input.title || '') + ' ' + codeStr + ' ' + (specs.original_title || '')
      if (/casting/i.test(blob)) return 'Casting'
      if (/spinning|spin/i.test(blob)) return 'Spinning'
      if (/conventional/i.test(blob)) return 'Conventional'
      return ''
    })()
    if (isKit) {
      // For kits prefer explicit kitType token (Casting/Spinning/Conventional) and suppress styleHits entirely to reduce noise.
      if (kitType) guideParts.push(kitType)
      // Count guides from leading dash-separated numbers in original_title/code/title
      const rawTitleConcat = (specs.original_title || '') + ' ' + (input.title || '') + ' ' + codeStr
      let guideCount = 0
      const dashPrefix = rawTitleConcat.trim().match(/^\s*(\d+(?:-\d+)+)/)
      if (dashPrefix) {
        guideCount = dashPrefix[1].split('-').filter(Boolean).length
      } else {
        // Fallback: count distinct small numbers (<= 50) before first brand token
        const preBrand = rawTitleConcat.split(/\b(Alps|Forecast|Batson)\b/i)[0]
        const nums = (preBrand.match(/\b\d{1,2}\b/g) || []).map(n => parseInt(n, 10)).filter(n => n > 0 && n <= 50)
        if (nums.length) guideCount = nums.length
      }
      guideParts.push('Guide Kit')
      if (guideCount) guideParts.push(`(${guideCount} Guides)`) // place count after 'Guide Kit'
    } else if (tube && !ring) guideParts.push('Tip Top')
    else guideParts.push('Guide')

    // Descriptor combining size + finish (ring color) + frame material/color
    const titleCase = (s: string) =>
      s
        .split(/\s+/)
        .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
        .join(' ')
        .trim()
    const finishDisplay = finish
      ? titleCase(
          String(finish)
            .replace(/finish|color/i, '')
            .trim(),
        )
      : ''
    const frameDisplay = frame ? titleCase(String(frame).replace(/frame/i, '').trim()) : ''
    let descriptor = ''
    if (ring) {
      descriptor = `Ring ${ring}${finishDisplay ? ' ' + finishDisplay : ''}${frameDisplay ? ' - ' + frameDisplay + ' Frame' : ''}`
    } else if (tube) {
      const tubeVal = `Tube ${tube}${tube && tube < 10 ? 'mm' : ''}`
      descriptor = `${tubeVal}${finishDisplay ? ' ' + finishDisplay : ''}${frameDisplay ? ' - ' + frameDisplay + ' Frame' : ''}`
    }
    if (descriptor) guideParts.push(descriptor)
    else {
      if (frameDisplay) guideParts.push(frameDisplay)
      if (finishDisplay) guideParts.push(finishDisplay)
    }
    // Remove code token per new request (omit externalId/code)
    const alt = clamp255(toSingleLine(guideParts.filter(Boolean).join(' ')))
    // Prefer alternative if placeholder, empty, or alt adds structure (token count heuristic)
    if (placeholder || !baseTitle || alt.split(' ').length >= baseTitle.split(' ').length - 1) baseTitle = alt
  }

  return baseTitle || toSingleLine(String(input.title || ''))
}

export default buildBatsonTitle
