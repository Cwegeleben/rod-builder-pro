import { describe, it, expect } from 'vitest'
import { buildBatsonReelSeatTitle, BatsonReelSeatCategoryContext, BatsonReelSeatRow } from '../batsonTitle'

// Focused unit test for AIP Contour enrichment.
// Ensures family 'AIP Contour' is included and standalone 'Contour' style is NOT appended.

describe('buildBatsonReelSeatTitle (AIP Contour)', () => {
  it('produces enriched AIP Contour title without SKU tokens', () => {
    const category: BatsonReelSeatCategoryContext = {
      brandFallback: 'Alps',
      categoryType: 'Aluminum Reel Seat',
    }
    const row: BatsonReelSeatRow = {
      rawName: 'Alps AIP Contour Reel Seat Matte Black',
      brandRaw: 'Alps',
      codeRaw: 'AIP20M-CWG-MB',
      familyName: 'AIP Contour',
      seatStyle: undefined, // explicitly ensure style not set
      size: '20',
      material: 'Aluminum',
      finishColor: 'Matte Black',
    }
    const title = buildBatsonReelSeatTitle(category, row)
    expect(title).toBe('Alps AIP Contour Aluminum Reel Seat Size 20 – Matte Black')
    // Assert absence of duplicate Contour style token
    expect(title.includes('Reel Seat Contour')).toBe(false)
    // Assert no raw code present
    expect(title.includes('AIP20M')).toBe(false)
  })
})
