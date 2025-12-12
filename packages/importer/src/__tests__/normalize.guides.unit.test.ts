import { describe, it, expect } from 'vitest'
import { normalize } from '../pipelines/normalize'

describe('normalize pipeline for guides/tip-tops', () => {
  it('extracts ring_size for guides from title/specs and preserves classification intent', () => {
    const res = normalize({
      title: 'ALPS Guide Ring 12 Black',
      partType: 'guide',
      rawSpecs: { finish: 'Black' },
    })
    expect(res.partType).toBe('guide')
    expect(res.specs.ring_size === 12 || res.specs.ring_size === '12').toBeTruthy()
  })

  it('extracts tube_size for tip tops and marks is_kit when kit keyword present', () => {
    const res = normalize({
      title: 'Forecast Tip Top Kit',
      partType: 'tip_top',
      rawSpecs: { tube_size: '6.0' },
    })
    expect(res.partType).toBe('tip_top')
    expect(Number(res.specs.tube_size)).toBeCloseTo(6.0)
    expect(res.specs.is_kit).toBeTruthy()
    expect(res.specs.tipTop).toMatchObject({
      tipTopType: 'Standard',
      tubeSizeMm: 6,
      title: expect.stringContaining('Tip Top'),
    })
  })
})
