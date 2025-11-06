import { describe, it, expect } from 'vitest'
import { buildShopifyPreview, validateShopifyPreview } from '../sync/shopify'

describe('buildShopifyPreview (Batson)', () => {
  it('includes spec metafields, unknown keys, and friendly range fields for Batson supplier', () => {
    const after = {
      supplierId: 'batson',
      externalId: 'RX8-IMM-78MH',
      title: 'Immortal RX8 Graphite 7\'10" 2pc MH Matte Black',
      description: 'Test rod blank',
      partType: 'rod blank',
      hashContent: 'hash-abc123',
      normSpecs: {
        series: 'Immortal RX8',
        length_in: 94,
        pieces: 2,
        power: 'MH',
        material: 'RX8 Graphite',
        color: 'Matte Black',
        line_lb: '10-20',
        line_lb_min: 10,
        line_lb_max: 20,
        lure_oz: '1/2-1',
        lure_oz_min: 0.5,
        lure_oz_max: 1.0,
        weight_oz: 3.2,
        butt_dia_in: 0.65,
        tip_top_size: 6,
        applications: ['Bass', 'Jig'],
        ten_in_dia: '0.50',
        twenty_in_dia: '0.45',
        thirty_in_dia: '0.40',
        mystery_value: 'Foo Extra', // unknown key passthrough
      },
      images: ['https://batsonenterprises.com/images/sample1.jpg'],
    }
    const preview = buildShopifyPreview(after, 'test-run-123')
    // Basic core assertions
    expect(preview.core.title).toContain('Immortal RX8')
    expect(preview.core.handle).toBe('rbp-batson-rx8-imm-78mh')
    // Variant grams derived from weight_oz
    expect(preview.variant.grams).toBe(Math.round(3.2 * 28.3495))

    // Metafields should include specs JSON, supplier_external_id, hash
    const mf = preview.metafields
    const byKey = (ns: string, k: string) => mf.find(m => m.namespace === ns && m.key === k)
    expect(byKey('rbp', 'specs')).toBeTruthy()
    expect(byKey('rbp', 'supplier_external_id')?.value).toBe('RX8-IMM-78MH')
    expect(byKey('rbp', 'hash')?.value).toBe('hash-abc123')

    // Known spec fields
    expect(byKey('rbp_spec', 'series')?.value).toBe('Immortal RX8')
    expect(byKey('rbp_spec', 'length_in')?.value).toBe('94')
    expect(byKey('rbp_spec', 'power')?.value).toBe('MH')
    expect(byKey('rbp_spec', 'line_lb')?.value).toBe('10-20')
    expect(byKey('rbp_spec', 'lure_oz')?.value).toBe('1/2-1')
    expect(byKey('rbp_spec', 'applications')?.value).toBe('Bass, Jig')
    expect(byKey('rbp_spec', 'ten_in_dia')?.value).toBe('0.50')
    expect(byKey('rbp_spec', 'twenty_in_dia')?.value).toBe('0.45')
    expect(byKey('rbp_spec', 'thirty_in_dia')?.value).toBe('0.40')

    // Unknown key passthrough
    expect(byKey('rbp_spec', 'mystery_value')?.value).toBe('Foo Extra')
    const unknownKeysMf = byKey('rbp', 'unknown_spec_keys')
    expect(unknownKeysMf).toBeTruthy()
    const unknownKeys = JSON.parse(String(unknownKeysMf?.value || '[]'))
    expect(unknownKeys).toContain('mystery_value')

    // Preview validation passes (no newline, <=255, numeric decimal strings handled as text metafields)
    const { ok, errors } = validateShopifyPreview(preview)
    expect(ok).toBe(true)
    expect(errors).toEqual([])
  })
})
