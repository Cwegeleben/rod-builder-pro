// Early series/header detection heuristic for Batson rod blanks (and similar suppliers)
// Goal: classify aggregate series pages BEFORE staging to avoid synthetic header diffs.
// Heuristic (positive header signals):
//  - externalId equals last path segment slug (case/sep normalized)
//  - externalId lacks any 2+ consecutive digits (model codes usually contain them)
//  - Missing a majority of core spec keys (length_in, pieces, action, power, material)
// Negative (disqualifying) signals: presence of a 2+ digit sequence OR >=2 core spec keys.
// Returns isHeader + reason for audit.

export type HeaderDetectInput = {
  url: string
  externalId: string
  title: string
  rawSpecs: Record<string, unknown>
}

export type HeaderDetectResult = { isHeader: boolean; reason?: string }

const CORE_SPEC_KEYS = ['length_in', 'pieces', 'action', 'power', 'material']

function lastPathSegment(url: string): string {
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean).pop() || ''
    return seg
  } catch {
    return ''
  }
}

function normalizeSlug(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9-]+/g, '-')
}

export function detectSeriesHeader(input: HeaderDetectInput): HeaderDetectResult {
  const { url, externalId, rawSpecs, title } = input
  const seg = lastPathSegment(url)
  const slugLike = normalizeSlug(seg)
  const extNorm = normalizeSlug(externalId)
  const slugMatch = slugLike === extNorm && !!slugLike
  const hasMultiDigitSequence = /[0-9]{2,}/.test(externalId)
  // Count present core spec keys (non-empty)
  const presentCore = CORE_SPEC_KEYS.filter(k => {
    const v = (rawSpecs as Record<string, unknown>)[k]
    return v != null && String(v).trim().length > 0
  })
  const fewCoreSpecs = presentCore.length < 2

  // Additional light signal: title contains words suggesting aggregate (e.g., 'Twitch', 'Series') AND few specs
  const aggregateToken = /(series|twitch|surf|glass)/i.test(title)

  const isHeader = slugMatch && !hasMultiDigitSequence && fewCoreSpecs && aggregateToken
  if (isHeader) {
    const reasonParts = [] as string[]
    if (slugMatch) reasonParts.push('slug-match')
    if (!hasMultiDigitSequence) reasonParts.push('no-multidigit')
    if (fewCoreSpecs) reasonParts.push('few-core-specs')
    if (aggregateToken) reasonParts.push('aggregate-token')
    return { isHeader: true, reason: reasonParts.join(',') }
  }
  return { isHeader: false }
}
