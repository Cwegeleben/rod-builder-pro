import { describe, it, expect } from 'vitest'
import { buildShopifyPreview, validateShopifyPreview } from '../sync/shopify'

// Ensure supplierId 'batson-rod-blanks' triggers WRITE_SPECS and spec metafields

describe('buildShopifyPreview (batson-rod-blanks)', () => {
  it('writes specs + discrete spec metafields for batson-rod-blanks', () => {
    const after = {
      supplierId: 'batson-rod-blanks',
      externalId: 'IMM-RX8-94MH',
      title: 'Immortal RX8 Graphite 7\'10" MH Matte Black',
      partType: 'rod blank',
      hashContent: 'hash-xyz',
      normSpecs: {
        series: 'Immortal RX8',
        length_in: 94,
        power: 'MH',
        material: 'RX8 Graphite',
        color: 'Matte Black',
        line_lb_min: 10,
        line_lb_max: 20,
        lure_oz_min: 0.5,
        lure_oz_max: 1.0,
        weight_oz: 3.2,
        butt_dia_in: 0.65,
        tip_top_size: 6,
        applications: ['Bass'],
        ten_in_dia: '0.50',
        twenty_in_dia: '0.45',
        thirty_in_dia: '0.40',
        extra_unknown: 'Something',
      },
    }
    const preview = buildShopifyPreview(after, 'run-rodblanks-123')
    const { ok, errors } = validateShopifyPreview(preview)
    expect(ok).toBe(true)
    expect(errors).toEqual([])
    const mf = preview.metafields
    const has = (ns: string, key: string) => mf.some(m => m.namespace === ns && m.key === key)
    expect(has('rbp', 'specs')).toBe(true)
    expect(has('rbp_spec', 'series')).toBe(true)
    expect(has('rbp_spec', 'length_in')).toBe(true)
    expect(has('rbp_spec', 'power')).toBe(true)
    expect(has('rbp_spec', 'ten_in_dia')).toBe(true)
    expect(has('rbp_spec', 'extra_unknown')).toBe(true)
    // unknown key tracking JSON
    expect(has('rbp', 'unknown_spec_keys')).toBe(true)
  })
})
