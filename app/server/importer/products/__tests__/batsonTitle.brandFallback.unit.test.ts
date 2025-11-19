import { describe, it, expect } from 'vitest'
import { buildBatsonReelSeatTitle, type BatsonReelSeatCategoryContext, type BatsonReelSeatRow } from '../batsonTitle'

// Ensure Batson is used strictly as a fallback brand and not as family/style,
// and that the strict fallback format is respected when no family is inferred.

describe('Batson reel seat brand fallback', () => {
  it('falls back to Batson brand with no family and omits style', () => {
    const category: BatsonReelSeatCategoryContext = {
      // no brandFallback
      categoryType: 'Graphite Reel Seat',
    }
    const row: BatsonReelSeatRow = {
      rawName: 'Graphite Reel Seat',
      // no brandRaw, no explicit series/slug brand hints
      codeRaw: 'XYZ16-ABC',
      material: 'Graphite',
      size: '16',
      seatStyle: 'Trigger', // should be omitted for Batson fallback when no family
      finishColor: 'Black',
      slug: '/reel-seats/graphite-reel-seat-black',
      series: 'Graphite Reel Seat',
    }
    const title = buildBatsonReelSeatTitle(category, row)
    expect(title).toBe('Batson Graphite Reel Seat Size 16 – Black')
    // Ensure no style token leaked
    expect(/Trigger/i.test(title)).toBe(false)
    // Ensure no code/model tokens leaked
    expect(/XYZ16/i.test(title)).toBe(false)
  })
})
