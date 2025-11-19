import { describe, expect, it } from 'vitest'
import { buildBatsonReelSeatTitle, type BatsonReelSeatCategoryContext, type BatsonReelSeatRow } from '../batsonTitle'

describe('buildBatsonReelSeatTitle - noise family tokens are suppressed', () => {
  it('drops single-letter tokens and material words from inferred family (e.g., "Alum R S W")', () => {
    const category: BatsonReelSeatCategoryContext = {
      // No explicit brand fallback; will infer and default to Batson
      categoryType: 'Aluminum Reel Seat',
    }
    const row: BatsonReelSeatRow = {
      // Simulate a messy page/title that previously led to family = "Alum R S W"
      rawName: '8 Alum Fly R S W Rec Hood Dbl Lock Nuts TR Gloss Black',
      brandRaw: '',
      codeRaw: 'RA801L2TR-S',
      // familyName empty means rely on inference
      familyName: undefined,
      seatStyle: 'Trigger',
      size: '801',
      material: 'Aluminum',
      finishColor: 'Silver',
      slug: '/reel-seats/8-alum-fly-r-s-w-rec-hood-dbl-lock-nuts-tr-gloss-black-ra801l2tr-s',
      series: 'Alum Fly R S W Rec Hood Dbl Lock Nuts',
    }

    const title = buildBatsonReelSeatTitle(category, row)
    // Strict fallback: when brand resolves to Batson and family inference yields nothing,
    // omit style and show: "Batson Aluminum Reel Seat Size 801 – Silver"
    expect(title).toBe('Batson Aluminum Reel Seat Size 801 – Silver')
  })
})
