import { describe, it, expect } from 'vitest'
import { detectSeriesHeader } from '../lib/headerDetect'

describe('detectSeriesHeader', () => {
  it('flags series header with slug match, no multi-digit sequence, few core specs', () => {
    const res = detectSeriesHeader({
      url: 'https://batsonenterprises.com/rod-blanks/the-judge-twitch-rx7-s-glass',
      externalId: 'THE-JUDGE-TWITCH-RX7-S-GLASS',
      title: 'The Judge RX7 S-Glass Twitch',
      rawSpecs: { original_title: 'The Judge RX7 S-Glass Twitch' },
    })
    expect(res.isHeader).toBe(true)
    expect(res.reason && res.reason.includes('slug-match')).toBe(true)
  })
  it('does not flag real product codes with multi-digit sequences', () => {
    const res = detectSeriesHeader({
      url: 'https://batsonenterprises.com/products/jdgtw710m-2cg',
      externalId: 'JDGTW710M-2CG',
      title: '7\'10" 2 pc RX7 Twitch Mod-F Medium 10-20lb CG',
      rawSpecs: { length_in: 94, power: 'M', action: 'Mod-F' },
    })
    expect(res.isHeader).toBe(false)
  })
})
