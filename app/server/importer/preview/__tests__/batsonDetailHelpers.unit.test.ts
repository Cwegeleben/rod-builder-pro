import { describe, expect, it } from 'vitest'
import { extractProductCodeFromHtml } from '../batsonDetailHelpers'

describe('extractProductCodeFromHtml', () => {
  it('pulls the Product Code value from Batson detail markup', () => {
    const html = `
      <div class="product-details-code">
        Product Code: <span>A16BP-B</span>
      </div>
    `
    expect(extractProductCodeFromHtml(html)).toBe('A16BP-B')
  })

  it('returns an empty string when the product code block is missing', () => {
    const html = '<div class="product-details-code">No span present</div>'
    expect(extractProductCodeFromHtml(html)).toBe('')
  })
})
