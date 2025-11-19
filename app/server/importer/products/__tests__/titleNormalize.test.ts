import { describe, it, expect } from 'vitest'
import { normalizeBatsonTitle, buildBatsonTitle } from '../titleNormalize'

describe('normalizeBatsonTitle', () => {
  it('builds full title with all parts', () => {
    const r = normalizeBatsonTitle({
      code: 'RX8-843',
      model: 'RX8-843',
      series: 'RX8',
      length_in: 99, // 8'3"
      material: 'Graphite',
      power: 'MEDIUM HEAVY',
      pieces: 2,
      color: 'Matte Black',
    })
    expect(r.title).toBe('RX8 8\'3" Graphite Medium Heavy 2pc Matte Black')
    expect(r.truncated).toBe(false)
  })

  it('falls back to code when model missing', () => {
    const r = normalizeBatsonTitle({ code: 'ABC123', series: 'SS', length_in: 96 })
    // With model/SKU removed, title should start with series + length
    expect(r.title.startsWith("SS 8'")) // 96 in => 8'
  })

  it('omits pieces if 1 or undefined', () => {
    // With only code present and policy removing SKU, expect empty title
    expect(buildBatsonTitle({ code: 'X1', pieces: 1 })).toBe('')
    expect(buildBatsonTitle({ code: 'X2' })).toBe('')
  })

  it('handles short lengths < 12 in', () => {
    const r = buildBatsonTitle({ code: 'SHORT', length_in: 10 })
    expect(r).toBe('10"')
  })

  it('truncates overly long titles', () => {
    const longSeries = 'S'.repeat(300)
    const r = normalizeBatsonTitle({ code: 'C', series: longSeries })
    expect(r.title.endsWith('…')).toBe(true)
    expect(r.title.length).toBeLessThanOrEqual(255)
    expect(r.truncated).toBe(true)
  })

  it('returns empty string if nothing present', () => {
    const r = buildBatsonTitle({})
    expect(r).toBe('')
  })

  it('formats reel seat with size and color', () => {
    const r = normalizeBatsonTitle({
      partType: 'Reel Seat',
      series: 'ALPS Aluminum Dual Trigger',
      model: 'DALT',
      size_label: '17',
      color: 'Black',
    })
    expect(r.title).toBe('ALPS Aluminum Dual Trigger Size 17 Black')
    expect(r.truncated).toBe(false)
  })
})
