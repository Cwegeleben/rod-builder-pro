import { describe, expect, it, vi } from 'vitest'
import { appendVaryHeader, isAllowedShopifyOrigin, withShopifyCors } from './shopify-cors.js'

function createResponse(initial: Record<string, string> = {}) {
  const headers = new Map<string, string>(Object.entries(initial))
  return {
    headersSent: false,
    getHeader: (name: string) => headers.get(name),
    setHeader: (name: string, value: string) => {
      headers.set(name, value)
    },
    dump: () => Object.fromEntries(headers.entries()),
  }
}

describe('isAllowedShopifyOrigin', () => {
  it('accepts admin.shopify.com', () => {
    expect(isAllowedShopifyOrigin('https://admin.shopify.com')).toBe(true)
  })

  it('accepts *.myshopify.com hosts', () => {
    expect(isAllowedShopifyOrigin('https://rbp-app.myshopify.com')).toBe(true)
  })

  it('rejects non-https protocols', () => {
    expect(isAllowedShopifyOrigin('http://admin.shopify.com')).toBe(false)
  })

  it('rejects unrelated origins', () => {
    expect(isAllowedShopifyOrigin('https://example.com')).toBe(false)
  })

  it('rejects malformed origins', () => {
    expect(isAllowedShopifyOrigin('not-a-url')).toBe(false)
  })
})

describe('appendVaryHeader', () => {
  it('adds header when missing', () => {
    const res = createResponse()
    appendVaryHeader(res, 'Origin')
    expect(res.dump()).toEqual({ Vary: 'Origin' })
  })

  it('deduplicates tokens', () => {
    const res = createResponse({ Vary: 'Accept-Encoding' })
    appendVaryHeader(res, 'Origin')
    appendVaryHeader(res, 'Origin')
    expect(res.dump()).toEqual({ Vary: 'Accept-Encoding, Origin' })
  })
})

describe('withShopifyCors', () => {
  it('sets Access-Control-Allow-Origin for trusted origins', () => {
    const res = createResponse()
    const next = vi.fn()
    withShopifyCors({ headers: { origin: 'https://admin.shopify.com' } }, res, next)
    expect(res.dump()).toEqual({ 'Access-Control-Allow-Origin': 'https://admin.shopify.com', Vary: 'Origin' })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('skips when origin is not trusted', () => {
    const res = createResponse()
    const next = vi.fn()
    withShopifyCors({ headers: { origin: 'https://example.com' } }, res, next)
    expect(res.dump()).toEqual({})
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('respects pre-existing headers', () => {
    const res = createResponse({ 'Access-Control-Allow-Origin': 'https://already.set' })
    const next = vi.fn()
    withShopifyCors({ headers: { origin: 'https://admin.shopify.com' } }, res, next)
    expect(res.dump()).toEqual({ 'Access-Control-Allow-Origin': 'https://already.set' })
    expect(next).toHaveBeenCalledTimes(1)
  })
})
