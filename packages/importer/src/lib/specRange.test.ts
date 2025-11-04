import { describe, expect, it } from 'vitest'
import { formatLineLbRangeString, formatLureOzRangeString } from './specRange'

describe('specRange formatters', () => {
  it('formats lbs ranges with normalized dash and unit', () => {
    expect(formatLineLbRangeString('8 – 12 lbs.')).toBe('8-12 lbs')
    expect(formatLineLbRangeString('8-12 lb')).toBe('8-12 lbs')
  })

  it('formats oz ranges preserving fractions', () => {
    expect(formatLureOzRangeString('1/4 - 1/2 oz.')).toBe('1/4-1/2 oz')
  })

  it('appends unit if missing and preserves single values', () => {
    expect(formatLineLbRangeString('10')).toBe('10 lbs')
    expect(formatLureOzRangeString('3/8')).toBe('3/8 oz')
  })
})
