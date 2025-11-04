import { describe, expect, it } from 'vitest'
import { extractBatsonAttributeGrid } from '../batsonAttributeGrid'

const html = `
<head>
  <meta property="og:image" content="https://example.com/og-image.jpg" />
</head>
<table class="table attribute-grid">
  <tbody>
    <tr>
      <td>RBX-123</td>
      <td>RX7-ML</td>
      <td class="information-attributes">
        <ul>
          <li class="information-attribute">
            <span class="information-attribute__label">Line Rating (lbs.)</span>
            <span class="information-attribute__text">8 – 12 lbs.</span>
          </li>
          <li class="information-attribute">
            <span class="information-attribute__label">Lure Weight Rating (oz.)</span>
            <span class="information-attribute__text">1/4 - 1/2 oz.</span>
          </li>
        </ul>
      </td>
      <td>In Stock</td>
    </tr>
  </tbody>
 </table>
`

describe('extractBatsonAttributeGrid', () => {
  it('produces human-friendly range strings alongside numeric min/max', () => {
    const res = extractBatsonAttributeGrid(html, 'https://batsonenterprises.com/rod-blanks/rx7')
    expect(res.rows.length).toBe(1)
    const spec = res.rows[0].spec
    expect(spec.line_lb).toBe('8-12 lbs')
    expect(spec.line_lb_min).toBe(8)
    expect(spec.line_lb_max).toBe(12)
    expect(spec.lure_oz).toBe('1/4-1/2 oz')
    expect(spec.lure_oz_min).toBeCloseTo(0.25, 5)
    expect(spec.lure_oz_max).toBeCloseTo(0.5, 5)
    // Picks up og:image as series image and attaches to rows
    expect(Array.isArray(spec.images)).toBe(true)
    expect(spec.images && spec.images[0]).toBe('https://example.com/og-image.jpg')
  })
  it('falls back to gallery main image when og:image is missing', () => {
    const sample = `
    <div class="product-detail-gallery">
      <img id="product-detail-gallery-main-img" src="/img/product/SPG601-GB-B.jpg?fv=AE336" />
    </div>
    <table class="table attribute-grid"><tbody><tr><td>RBX-1</td><td>RX7</td><td class="information-attributes">
      <ul><li class="information-attribute"><span class="information-attribute__label">Line Rating (lbs.)</span><span class="information-attribute__text">8 - 12 lbs.</span></li></ul>
    </td><td>In Stock</td></tr></tbody></table>`
    const res = extractBatsonAttributeGrid(sample, 'https://batsonenterprises.com/rod-blanks/foo')
    const spec = res.rows[0].spec
    expect(spec.images && spec.images[0]).toBe('https://batsonenterprises.com/img/product/SPG601-GB-B.jpg?fv=AE336')
  })
})
