import { describe, expect, it } from 'vitest'
import { crawlBatsonRodBlanksListing } from '../batsonListing'

const BASE = 'https://batsonenterprises.com/rod-blanks'

describe('crawlBatsonRodBlanksListing URL normalization', () => {
  it('resolves relative series URLs without duplicating /rod-blanks/', () => {
    const html = `
      <div id="ListingProducts">
        <div class="ejs-productitem" data-product-url="/rod-blanks/rainshadow-revelation"></div>
        <a href="/rod-blanks/rainshadow-immortal">Immortal</a>
      </div>
    `
    const urls = crawlBatsonRodBlanksListing(html, BASE)
    expect(urls).toContain('https://batsonenterprises.com/rod-blanks/rainshadow-revelation')
    expect(urls).toContain('https://batsonenterprises.com/rod-blanks/rainshadow-immortal')
    urls.forEach(u => expect(u.includes('/rod-blanks/rod-blanks/')).toBe(false))
  })

  it('preserves fully-qualified Batson URLs as-is', () => {
    const html = `
      <div id="ListingProducts">
        <a href="https://batsonenterprises.com/rod-blanks/rainshadow-revelation">Revelation</a>
      </div>
    `
    const urls = crawlBatsonRodBlanksListing(html, BASE)
    expect(urls).toEqual(['https://batsonenterprises.com/rod-blanks/rainshadow-revelation'])
  })
})
