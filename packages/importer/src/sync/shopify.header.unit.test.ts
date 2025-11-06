import { describe, it, expect } from 'vitest'

// Local copy of minimal heuristic logic to unit test quickly.
// Use unknown to satisfy lint while keeping flexibility for test input
function isHeaderCandidate(
  externalId: string,
  rawSpecs: Record<string, unknown>,
  normSpecs: Record<string, unknown>,
): boolean {
  const noSpecs = Object.keys(rawSpecs || {}).length === 0 && Object.keys(normSpecs || {}).length === 0
  const coreKeys = ['length_in', 'pieces', 'action', 'power', 'material']
  const hasCoreSpec = coreKeys.some(k => {
    const v = (normSpecs || ({} as Record<string, unknown>))[k]
    return v != null && String(v).trim().length > 0
  })
  const exIdStr = String(externalId || '')
  const has2PlusDigits = /\d{2,}/.test(exIdStr)
  const totalDigits = (exIdStr.match(/\d/g) || []).length
  const has3PlusDigitsTotal = totalDigits >= 3
  const knownHeaderToken = /\bSURF\b/i.test(exIdStr)
  return (noSpecs || !hasCoreSpec) && (knownHeaderToken || !has2PlusDigits || !has3PlusDigitsTotal)
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

  it('classifies when only raw specs present but no normalized core specs', () => {
    expect(isHeaderCandidate('RX7', { a: 1 }, {})).toBe(true)
  })

  it('classifies tokenless non-numeric externalId with empty specs as header', () => {
    expect(isHeaderCandidate('RX7', {}, {})).toBe(true)
  })

  // Note: IDs with digits like RX7-60 are not auto-classified as headers; decision left to series tokening or core specs presence

  it('classifies when only trivial series present but no core specs', () => {
    expect(isHeaderCandidate('RX7-SURF', {}, { series: 'RX7 SURF' })).toBe(true)
    expect(isHeaderCandidate('RX7-CUSTOM', {}, { series: 'RX7' })).toBe(true)
  })
})
