import { describe, it, expect } from 'vitest'
import type { DesignStorefrontOption } from '../storefront.mock'
import {
  buildCompatibilityContextFromSelections,
  filterOptionsByCompatibility,
  normalizeDesignStudioCompatibility,
} from '../compatibility'

describe('design studio compatibility helpers', () => {
  const blankOption: DesignStorefrontOption = {
    id: 'blank-1',
    role: 'blank',
    title: 'RX10 76ML',
    price: 189,
    specs: [],
    compatibility: normalizeDesignStudioCompatibility({ buttDiameterIn: 0.95, tipDiameterMm: 2 }),
  }

  const handleOption = (insideDiameterIn: number): DesignStorefrontOption => ({
    id: `handle-${insideDiameterIn}`,
    role: 'handle',
    title: 'Rear grip',
    price: 32,
    specs: [],
    compatibility: normalizeDesignStudioCompatibility({ insideDiameterIn }),
  })

  const tipTopOption = (tubeSizeMm: number): DesignStorefrontOption => ({
    id: `tip-${tubeSizeMm}`,
    role: 'tip_top',
    title: 'Tip top',
    price: 12,
    specs: [],
    compatibility: normalizeDesignStudioCompatibility({ tubeSizeMm }),
  })

  it('builds compatibility context from blank selections', () => {
    const context = buildCompatibilityContextFromSelections({ blank: blankOption })
    expect(context?.blank?.buttDiameterIn).toBeCloseTo(0.95)
  })

  it('filters handle options whose bore is smaller than blank butt', () => {
    const context = { blank: blankOption.compatibility }
    const { allowed, rejected } = filterOptionsByCompatibility(
      [handleOption(0.94), handleOption(1.05)],
      'handle',
      context,
    )
    expect(allowed.map(option => option.id)).toEqual(['handle-1.05'])
    expect(rejected).toHaveLength(1)
    expect(rejected[0].issues[0].code).toBe('butt-od-too-large')
  })

  it('filters tip tops when tube size is smaller than blank tip', () => {
    const blank = {
      ...blankOption,
      compatibility: normalizeDesignStudioCompatibility({ tipDiameterMm: 2.5 }),
    }
    const context = { blank: blank.compatibility }
    const { allowed, rejected } = filterOptionsByCompatibility(
      [tipTopOption(2.2), tipTopOption(2.7)],
      'tip_top',
      context,
    )
    expect(allowed.map(option => option.id)).toEqual(['tip-2.7'])
    expect(rejected[0].issues[0].code).toBe('tip-od-too-large')
  })
})
