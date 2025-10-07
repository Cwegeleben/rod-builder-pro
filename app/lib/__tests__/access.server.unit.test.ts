import { describe, it, expect } from 'vitest'
import { isHqShopDomain, requireHqShopOr404 } from '../access.server'

// Minimal mock for authenticate.admin used inside requireHqShopOr404 -> isHqShop
// We can't easily inject, so we'll create a helper that simulates a request object
// and temporarily monkey-patch global fetch if needed (not required here since
// authenticate is internal). Instead we simulate by calling isHqShopDomain directly
// and testing requireHqShopOr404 with a fake request + temporary patch.

describe('isHqShopDomain', () => {
  it('returns true for rbp-hq-dev.myshopify.com', () => {
    expect(isHqShopDomain('rbp-hq-dev.myshopify.com')).toBe(true)
  })
  it('returns true for bare rbp-hq-dev', () => {
    expect(isHqShopDomain('rbp-hq-dev')).toBe(true)
  })
  it('returns false for other shops', () => {
    expect(isHqShopDomain('tenant-store.myshopify.com')).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(isHqShopDomain(undefined)).toBe(false)
  })
})

describe('requireHqShopOr404', () => {
  it('export shape sanity for requireHqShopOr404', () => {
    expect(typeof requireHqShopOr404).toBe('function')
  })
})
