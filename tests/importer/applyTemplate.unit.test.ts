import { describe, it, expect } from 'vitest'

import { applyTemplate } from '../../src/importer/extract/applyTemplate'

describe('applyTemplate', () => {
  it('returns usedTemplateKey when provided explicitly', () => {
    const res = applyTemplate(
      { url: 'https://batsonenterprises.com/products/foo' },
      { templateKey: 'batson.product.v2' },
    )
    expect(res.usedTemplateKey).toBe('batson.product.v2')
  })

  it('auto-detects a template when none provided (batson hostname)', () => {
    const res = applyTemplate({ url: 'https://batsonenterprises.com/products/bar' })
    expect(typeof res.usedTemplateKey).toBe('string')
    expect(res.usedTemplateKey).toBeTruthy()
    // current heuristic always falls back to batson.product.v2
    expect(res.usedTemplateKey).toBe('batson.product.v2')
  })
})
