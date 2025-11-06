import { describe, it, expect } from 'vitest'
import { shouldStageBatsonProduct } from '../crawlers/batsonCrawler'

describe('shouldStageBatsonProduct', () => {
  it('skips header when isHeader true', () => {
    const res = shouldStageBatsonProduct(
      { externalId: 'THE-JUDGE-TWITCH-RX7-S-GLASS', isHeader: true },
      'https://batsonenterprises.com/rod-blanks/the-judge-twitch-rx7-s-glass',
    )
    expect(res.stage).toBe(false)
    expect(res.reason).toBe('header-heuristic')
  })
  it('skips series path slug match without products segment', () => {
    const res = shouldStageBatsonProduct(
      { externalId: 'THE-JUDGE-TWITCH-RX7-S-GLASS' },
      'https://batsonenterprises.com/rod-blanks/the-judge-twitch-rx7-s-glass',
    )
    expect(res.stage).toBe(false)
    expect(res.reason).toBe('series-path-slug')
  })
  it('stages real product under /products path', () => {
    const res = shouldStageBatsonProduct(
      { externalId: 'JDGTW710M-2CG' },
      'https://batsonenterprises.com/products/jdgtw710m-2cg',
    )
    expect(res.stage).toBe(true)
  })
})
