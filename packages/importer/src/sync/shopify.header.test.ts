import { describe, it, expect } from 'vitest'

// Local copy of minimal heuristic logic to unit test quickly.
// Use unknown to satisfy lint while keeping flexibility for test input
function isHeaderCandidate(
  externalId: string,
  rawSpecs: Record<string, unknown>,
  normSpecs: Record<string, unknown>,
): boolean {
  const noSpecs = Object.keys(rawSpecs || {}).length === 0 && Object.keys(normSpecs || {}).length === 0
  const exIdStr = String(externalId || '')
  const has2PlusDigits = /\d{2,}/.test(exIdStr)
  const knownHeaderToken = /\bSURF\b/i.test(exIdStr)
  return noSpecs && (knownHeaderToken || !has2PlusDigits)
}

describe('header classification heuristic', () => {
  it('classifies RX7-SURF as header when specs empty', () => {
    expect(isHeaderCandidate('RX7-SURF', {}, {})).toBe(true)
  })

  it('does not classify SU1569F-M as header (has 2+ consecutive digits)', () => {
    expect(isHeaderCandidate('SU1569F-M', {}, {})).toBe(false)
  })

  it('does not classify SU1418F-M as header (has 2+ consecutive digits)', () => {
    expect(isHeaderCandidate('SU1418F-M', {}, {})).toBe(false)
  })

  it('does not classify non-empty specs even if tokenless externalId', () => {
    expect(isHeaderCandidate('RX7', { a: 1 }, {})).toBe(false)
    expect(isHeaderCandidate('RX7', {}, { b: 2 })).toBe(false)
  })

  it('classifies tokenless non-numeric externalId with empty specs as header', () => {
    expect(isHeaderCandidate('RX7', {}, {})).toBe(true)
  })
})
