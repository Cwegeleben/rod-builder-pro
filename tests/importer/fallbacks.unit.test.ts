import { describe, it, expect } from 'vitest'

import { slugFromPath, hash } from '../../src/importer/extract/fallbacks'

describe('fallbacks', () => {
  it('slugFromPath extracts and normalizes last path segment', () => {
    expect(slugFromPath('https://batsonenterprises.com/products/ABC-123')).toBe('abc-123')
    expect(slugFromPath('https://batsonenterprises.com/collections/rods/items/Trout_Rod_7-6.html')).toBe(
      'trout-rod-7-6',
    )
  })

  it('slugFromPath returns null for invalid URLs', () => {
    expect(slugFromPath('not-a-url')).toBeNull()
  })

  it('hash produces a short deterministic hash of URL', () => {
    const a = hash('https://batsonenterprises.com/products/ABC-123')
    const b = hash('https://batsonenterprises.com/products/ABC-123')
    const c = hash('https://batsonenterprises.com/products/DEF-999')
    expect(a).toHaveLength(12)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
