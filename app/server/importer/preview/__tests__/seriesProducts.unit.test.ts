// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { describe, it, expect } from 'vitest'
import { extractSeriesProducts } from '../seriesProducts'

const BASE = 'https://batsonenterprises.com'

const FIXTURE = `
<table class="table attribute-grid">
  <thead>
    <tr><th>Code</th><th>Model</th><th>Information</th><th>Availability</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="/rx6/rx6-salmon-steelhead">RX6-SS</a></td>
      <td>SS-100H</td>
      <td>
        <ul>
          <li>Length: 10' 0"</li>
          <li>Power: Heavy</li>
          <li>Action: Fast</li>
        </ul>
      </td>
      <td>In Stock</td>
    </tr>
    <tr>
      <td><a href="/rx6/rx6-e-glass-jig-boat">RX6-JB</a></td>
      <td>JB-80M</td>
      <td>
        <ul>
          <li>Length: 8' 0"</li>
          <li>Power: Medium</li>
        </ul>
      </td>
      <td>Backorder</td>
    </tr>
  </tbody>
</table>
`

describe('extractSeriesProducts', () => {
  it('parses table rows into product entries with absolute URLs', () => {
    const rows = extractSeriesProducts(FIXTURE, BASE)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows[0].url.startsWith(BASE)).toBe(true)
    expect(rows[0].title).toBeDefined()
  })

  it('parses Batson listing items using data-product-url under #ListingProducts', () => {
    const LISTING = `
      <div id="ListingProducts">
        <div class="ejs-productitem" data-product-url="/rod-blanks/solid-glass-heavy-duty"></div>
        <div class="ejs-productitem" data-product-url="/rod-blanks/rx6-e-glass-jig-boat"></div>
      </div>
    `
    const rows = extractSeriesProducts(LISTING, BASE)
    expect(rows.length).toBe(2)
    expect(rows[0].url).toBe(`${BASE}/rod-blanks/solid-glass-heavy-duty`)
    expect(rows[1].url).toBe(`${BASE}/rod-blanks/rx6-e-glass-jig-boat`)
  })
})
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
