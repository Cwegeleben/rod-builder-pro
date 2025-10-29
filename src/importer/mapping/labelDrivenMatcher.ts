// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 -->
// Label-driven template field matcher: normalize text, fuzzy-match labels (with synonyms),
// type-cast values, and return explainable matches with confidence scores.

export type TemplateField = {
  key: string
  label: string
  synonyms?: string[]
  type?: 'text' | 'number' | 'feet-inches' | 'range-lb' | 'range-oz' | 'currency'
  required?: boolean
}

export type Match = {
  key: string
  sourceLabel: string
  rawValue: string
  value: unknown
  score: number
  why: string[]
}

export type MatchResult = {
  mapped: Match[]
  unmapped: Array<{ key: string; label: string; required?: boolean }>
  sourceUnused: Array<{ label: string; value: string }>
}

// Basic HTML entity decoding and cleanup
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function normalize(s: string): string {
  return decodeEntities(String(s || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[_:\u2013\u2014]+/g, ' ')
    .replace(/\((?:[^)]*)\)/g, '') // strip hints in parentheses
    .replace(/[^a-z0-9$./'" -]+/gi, '')
    .trim()
}

function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean)
}

function jaccard(aRaw: string, bRaw: string): number {
  const a = new Set(tokenize(aRaw))
  const b = new Set(tokenize(bRaw))
  if (a.size === 0 && b.size === 0) return 1
  const inter = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return inter.size / union.size
}

function levenshteinRatio(aRaw: string, bRaw: string): number {
  const a = normalize(aRaw)
  const b = normalize(bRaw)
  const m = a.length
  const n = b.length
  if (m === 0 && n === 0) return 1
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  const dist = dp[m][n]
  const maxLen = Math.max(m, n) || 1
  return 1 - dist / maxLen
}

function blendedSimilarity(a: string, b: string): { score: number; why: string[] } {
  const why: string[] = []
  const an = normalize(a)
  const bn = normalize(b)
  if (an === bn) {
    why.push('exact label match')
    return { score: 1.0, why }
  }
  const jac = jaccard(a, b)
  const lev = levenshteinRatio(a, b)
  // Simple blend with small boost for prefix/suffix overlaps
  let score = 0.5 * jac + 0.5 * lev
  if (bn.startsWith(an) || an.startsWith(bn)) score += 0.05
  if (bn.includes(an) || an.includes(bn)) score += 0.03
  why.push(`jaccard=${jac.toFixed(2)}`, `lev=${lev.toFixed(2)}`)
  return { score: Math.min(1, score), why }
}

// Type-aware casters
function parseFeetInches(v: string): { inches: number; raw: string; why: string[] } | null {
  const s = String(v).trim()
  // Examples: 8'6", 8 ft 6 in, 8.5', 8ft
  const m1 = s.match(/(\d+)\s*(?:'|ft)\s*(\d+)?\s*(?:"|in)?/i)
  if (m1) {
    const feet = parseInt(m1[1], 10) || 0
    const inches = parseInt(m1[2] || '0', 10) || 0
    return { inches: feet * 12 + inches, raw: s, why: ['feet-inches'] }
  }
  const m2 = s.match(/(\d+(?:\.\d+)?)\s*(?:'|ft)/i)
  if (m2) {
    const feetF = parseFloat(m2[1])
    return { inches: Math.round(feetF * 12), raw: s, why: ['feet-inches-decimal'] }
  }
  // 8.5 → assume feet
  const m3 = s.match(/^(\d+(?:\.\d+)?)$/)
  if (m3) return { inches: Math.round(parseFloat(m3[1]) * 12), raw: s, why: ['feet-implicit'] }
  return null
}

function parseFraction(s: string): number | null {
  const m = s.match(/^(\d+)\/(\d+)$/)
  if (m) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    if (b) return a / b
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseRangeOz(v: string): { oz_min: number; oz_max: number; raw: string } | null {
  const s = normalize(v).replace(/oz\.?/g, 'oz')
  const m = s.match(/([0-9./]+)\s*[-–]\s*([0-9./]+)\s*oz/)
  if (!m) return null
  const lo = parseFraction(m[1])
  const hi = parseFraction(m[2])
  if (lo == null || hi == null) return null
  return { oz_min: lo, oz_max: hi, raw: v }
}

function parseRangeLb(v: string): { lb_min: number; lb_max: number; raw: string } | null {
  const s = normalize(v).replace(/lbs?\.?/g, 'lb')
  const m = s.match(/([0-9./]+)\s*[-–]\s*([0-9./]+)\s*lb/)
  if (!m) return null
  const lo = parseFraction(m[1])
  const hi = parseFraction(m[2])
  if (lo == null || hi == null) return null
  return { lb_min: lo, lb_max: hi, raw: v }
}

function parseCurrency(v: string): { amount: number; currency: string; raw: string } | null {
  const s = String(v).trim()
  const usd = s.match(/\$\s*([0-9,.]+)/)
  if (usd) {
    const amount = Number(usd[1].replace(/,/g, ''))
    if (Number.isFinite(amount)) return { amount, currency: 'USD', raw: s }
  }
  const cur = s.match(/([A-Z]{3})\s*([0-9,.]+)/)
  if (cur) {
    const amount = Number(cur[2].replace(/,/g, ''))
    if (Number.isFinite(amount)) return { amount, currency: cur[1], raw: s }
  }
  const num = Number(s.replace(/,/g, ''))
  if (Number.isFinite(num)) return { amount: num, currency: 'USD', raw: s }
  return null
}

function castValue(type: TemplateField['type'] | undefined, v: string): { value: unknown; why: string[] } {
  if (!type) return { value: v, why: [] }
  switch (type) {
    case 'feet-inches': {
      const p = parseFeetInches(v)
      if (p) return { value: p.inches, why: [...p.why, `cast:${type}`] }
      return { value: v, why: ['cast-failed'] }
    }
    case 'range-oz': {
      const p = parseRangeOz(v)
      if (p) return { value: { oz_min: p.oz_min, oz_max: p.oz_max }, why: [`cast:${type}`] }
      return { value: v, why: ['cast-failed'] }
    }
    case 'range-lb': {
      const p = parseRangeLb(v)
      if (p) return { value: { lb_min: p.lb_min, lb_max: p.lb_max }, why: [`cast:${type}`] }
      return { value: v, why: ['cast-failed'] }
    }
    case 'currency': {
      const p = parseCurrency(v)
      if (p) return { value: { amount: p.amount, currency: p.currency }, why: [`cast:${type}`] }
      return { value: v, why: ['cast-failed'] }
    }
    case 'number': {
      const n = Number(String(v).replace(/,/g, ''))
      return Number.isFinite(n) ? { value: n, why: ['cast:number'] } : { value: v, why: ['cast-failed'] }
    }
    case 'text':
    default:
      return { value: v, why: [] }
  }
}

export function matchTemplateFieldsFromKV(fields: TemplateField[], kv: Record<string, unknown>): MatchResult {
  // Prepare candidate labels from kv; only string-like values are matched
  const candidates: Array<{ label: string; value: string }> = []
  for (const [k, v] of Object.entries(kv || {})) {
    if (v == null) continue
    const s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null
    if (s == null || normalize(s) === '') continue
    candidates.push({ label: String(k), value: s })
  }

  const mapped: Match[] = []
  const used = new Set<number>()

  for (const f of fields) {
    const choices: Array<{ idx: number; score: number; why: string[]; label: string; value: string }> = []
    const names = [f.label, ...(f.synonyms || [])]
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      let bestScore = 0
      let because: string[] = []
      for (const nm of names) {
        const { score, why } = blendedSimilarity(nm, c.label)
        let sc = score
        // Boost for exact normalized matches
        if (normalize(nm) === normalize(c.label)) sc += 0.2
        // Boost for prefix words overlap
        const nmtoks = tokenize(nm)
        const ctoks = tokenize(c.label)
        if (nmtoks.length && ctoks.length && nmtoks[0] === ctoks[0]) sc += 0.05
        if (sc > bestScore) {
          bestScore = sc
          because = [`match:${nm}~${c.label}`, ...why]
        }
      }
      choices.push({ idx: i, score: Math.min(1, bestScore), why: because, label: c.label, value: c.value })
    }
    choices.sort((a, b) => b.score - a.score)
    const top = choices.find(c => !used.has(c.idx))
    if (top && top.score >= 0.45) {
      const cast = castValue(f.type, top.value)
      const score = top.score
      const why = [...top.why, ...cast.why]
      mapped.push({ key: f.key, sourceLabel: top.label, rawValue: top.value, value: cast.value, score, why })
      used.add(top.idx)
    }
  }

  const thresholdAuto = 0.7
  // Split unmapped as the set of fields that did not reach even review threshold
  const mappedKeys = new Set(mapped.filter(m => m.score >= 0.45).map(m => m.key))
  const unmapped = fields
    .filter(f => !mappedKeys.has(f.key))
    .map(f => ({ key: f.key, label: f.label, required: f.required }))

  const sourceUnused: Array<{ label: string; value: string }> = candidates
    .filter((_, i) => !used.has(i))
    .map(c => ({ label: c.label, value: c.value }))

  // Optionally, downgrade mapped entries below auto threshold to review status via why note
  for (const m of mapped) {
    if (m.score < thresholdAuto) m.why.push('needs-review')
  }

  return { mapped, unmapped, sourceUnused }
}
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 -->
