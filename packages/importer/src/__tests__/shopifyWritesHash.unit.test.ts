import { describe, it, expect } from 'vitest'
import { buildShopifyPreview, sanitizeMetafields } from '../sync/shopify'

describe('rbp.hash metafield', () => {
  it('includes rbp.hash when after.hashContent is provided', () => {
    const after = {
      supplierId: 'batson',
      externalId: 'X123',
      title: 'Sample',
      partType: 'part',
      hashContent: 'hash-abc123',
      normSpecs: { series: 'RX7', length_in: '84', pieces: '2' },
    }
    const p = buildShopifyPreview(after, 'run-1')
    const mf = p.metafields.find(m => m.namespace === 'rbp' && m.key === 'hash')
    expect(mf).toBeTruthy()
    expect(mf!.value).toBe('hash-abc123')
  })

  it('falls back to a deterministic hash when after.hashContent is empty', () => {
    const after = {
      supplierId: 'batson',
      externalId: 'X124',
      title: 'Sample 2',
      partType: 'part',
      hashContent: '',
      normSpecs: { series: 'RX7', length_in: '84', pieces: '2' },
    }
    const p = buildShopifyPreview(after, 'run-1')
    const mf = p.metafields.find(m => m.namespace === 'rbp' && m.key === 'hash')
    expect(mf).toBeTruthy()
    expect(String(mf!.value).length).toBeGreaterThan(10)
  })

  it('sanitizeMetafields drops empty rbp.hash values and warns', () => {
    const mfs = [{ namespace: 'rbp', key: 'hash', type: 'single_line_text_field', value: '' }]
    const { metafields, warnings } = sanitizeMetafields(mfs)
    expect(metafields.find(m => m.namespace === 'rbp' && m.key === 'hash')).toBeFalsy()
    expect(warnings.some(w => /drop rbp\.hash/.test(w))).toBeTruthy()
  })
})
