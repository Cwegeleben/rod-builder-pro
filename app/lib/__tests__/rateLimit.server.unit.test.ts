import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, assertRateLimit, _resetRateLimitBuckets } from '../rateLimit.server'

describe('rateLimit', () => {
  beforeEach(() => _resetRateLimitBuckets())

  it('allows within limit', () => {
    const res1 = checkRateLimit({ key: 'k1', limit: 2, windowMs: 1000 })
    expect(res1.allowed).toBe(true)
    const res2 = checkRateLimit({ key: 'k1', limit: 2, windowMs: 1000 })
    expect(res2.allowed).toBe(true)
  })

  it('blocks when exceeding limit', () => {
    checkRateLimit({ key: 'k2', limit: 1, windowMs: 1000 })
    const res = checkRateLimit({ key: 'k2', limit: 1, windowMs: 1000 })
    expect(res.allowed).toBe(false)
  })

  it('assertRateLimit throws after limit', () => {
    assertRateLimit({ key: 'k3', limit: 1, windowMs: 1000 })
    expect(() => assertRateLimit({ key: 'k3', limit: 1, windowMs: 1000 })).toThrow()
  })
})
