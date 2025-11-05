import { describe, it, expect } from 'vitest'
import { validateShopifyPreview, type ShopifyPreview } from './shopify'

function mkPreview(overrides: Partial<ShopifyPreview> = {}): ShopifyPreview {
  const base: ShopifyPreview = {
    core: {
      title: 'Test Product',
      body_html: '<p>Body</p>',
      vendor: 'Vendor',
      product_type: 'part',
      handle: 'rbp-supplier-123',
      tags: 'part, supplier',
    },
    variant: {
      sku: 'SKU-123',
      price: '12.34',
      compare_at_price: undefined,
      grams: 123,
      taxable: true,
      inventory_policy: 'deny',
      inventory_management: null,
    },
    metafields: [
      { namespace: 'rbp', key: 'hash', type: 'single_line_text_field', value: 'abc' },
      { namespace: 'rbp', key: 'specs', type: 'json', value: JSON.stringify({ a: 1 }) },
      { namespace: 'rbp.spec', key: 'series', type: 'single_line_text_field', value: 'Series A' },
    ],
    images: [],
  }
  return {
    ...base,
    ...overrides,
    core: { ...base.core, ...(overrides.core || {}) },
    variant: { ...base.variant, ...(overrides.variant || {}) },
    metafields: overrides.metafields || base.metafields,
    images: overrides.images || base.images,
  }
}

describe('validateShopifyPreview', () => {
  it('accepts a valid preview', () => {
    const p = mkPreview()
    const res = validateShopifyPreview(p)
    expect(res.ok).toBe(true)
    expect(res.errors).toEqual([])
  })

  it('rejects sku with newlines', () => {
    const p = mkPreview({ variant: { ...mkPreview().variant, sku: 'SKU-\n-123' } })
    const res = validateShopifyPreview(p)
    expect(res.ok).toBe(false)
    expect(res.errors.some(e => e.includes('variant.sku'))).toBe(true)
  })

  it('rejects single_line_text_field metafield that violates constraints', () => {
    const long = 'x'.repeat(260)
    const p1 = mkPreview({
      metafields: [{ namespace: 'rbp', key: 'k', type: 'single_line_text_field', value: 'bad\nvalue' }],
    })
    const r1 = validateShopifyPreview(p1)
    expect(r1.ok).toBe(false)
    expect(r1.errors.some(e => e.includes('must not contain newlines'))).toBe(true)

    const p2 = mkPreview({ metafields: [{ namespace: 'rbp', key: 'k', type: 'single_line_text_field', value: long }] })
    const r2 = validateShopifyPreview(p2)
    expect(r2.ok).toBe(false)
    expect(r2.errors.some(e => e.includes('must be <=255 chars'))).toBe(true)
  })

  it('rejects list.single_line_text_field with invalid element', () => {
    const bad = mkPreview({
      metafields: [
        {
          namespace: 'rbp.spec',
          key: 'applications',
          type: 'list.single_line_text_field',
          value: JSON.stringify(['ok', 'bad\n']),
        },
      ],
    })
    const r = validateShopifyPreview(bad)
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => e.includes('list elements'))).toBe(true)
  })
})
