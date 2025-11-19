import { describe, it, expect } from 'vitest'
import { buildBatsonTitle } from '../titleNormalize'

// Ensure strict Batson fallback for reel-seat target when brand not detected and no family is inferred

describe('titleNormalize: Batson reel-seat brand fallback', () => {
  it('produces Batson <Material> Reel Seat Size N – Color with no style or codes', () => {
    const title = buildBatsonTitle({
      // code does not indicate Alps/Forecast, triggers Batson fallback
      code: 'XYZ16-ABC',
      series: 'Graphite Reel Seat',
      size_label: '16',
      color: 'Black',
      partType: 'Reel Seat',
    })
    expect(title).toBe('Batson Graphite Reel Seat Size 16 – Black')
  })

  it('detects Alps via code prefix and does not fall back to Batson', () => {
    const title = buildBatsonTitle({
      code: 'AIP20M-CWG',
      series: 'AIP Contour Reel Seat',
      size_label: '20',
      color: 'Matte Black',
      partType: 'Reel Seat',
    })
    // Brand should be Alps due to code prefix AIP
    expect(title.startsWith('Alps ')).toBe(true)
  })
})
