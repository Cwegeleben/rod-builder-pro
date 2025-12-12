import { describe, it, expect } from 'vitest'
import { getTipTopType, normalizeTipTop, FRAME_MATERIAL_MAP, RING_MATERIAL_MAP } from '../lib/tipTop'

describe('tip-top helpers', () => {
  it('derives heavy duty from SKU prefix', () => {
    expect(getTipTopType({ sku: 'HTT6.0-8C' })).toBe('Heavy Duty')
  })

  it('falls back to standard when no hint found', () => {
    expect(getTipTopType({ sku: 'FTT5.5-6C' })).toBe('Standard')
  })

  it('normalizes materials and sizes for title builder', () => {
    const normalized = normalizeTipTop({
      sku: 'BTT5.5-8',
      title: 'Boat Tip Top',
      frameMaterial: 'SS316',
      ringMaterial: 'HRA',
      tubeSize: '5.5',
      ringSize: '8',
    })
    expect(normalized).toMatchObject({
      tipTopType: 'Boat',
      frameMaterialLong: FRAME_MATERIAL_MAP.SS316,
      ringMaterialLong: RING_MATERIAL_MAP.HRA,
      tubeSizeMm: 5.5,
      ringSize: 8,
      familyHint: 'boatTipTop',
      title: 'Boat Tip Top 316 Stainless Steel 5.5 Tube – Hardloy 8 Ring',
    })
  })
})
