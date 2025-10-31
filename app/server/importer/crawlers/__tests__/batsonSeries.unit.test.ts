// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { describe, it, expect } from 'vitest'
import { crawlBatsonBlanksbySeries } from '../batsonSeries'

const BASE = 'https://batsonenterprises.com'

const FIXTURE_HTML = `
<div class="ejs-productitem span3">
  <div class="box-photo product-image-container ejs-box-photo ejs-product-image-container"
       data-product-url="/blanks-by-series/solid-glass-heavy-duty"></div>
  <div class="box-info">
    <ul class="unstyled">
      <li class="product-title"><a href="/blanks-by-series/solid-glass-heavy-duty" class="product-title">Solid Glass - Heavy Duty</a></li>
    </ul>
  </div>
  <div class="box-price"><a class="btn btn-primary" href="/blanks-by-series/solid-glass-heavy-duty">See All Items</a></div>
</div>

<div class="ejs-productitem span3">
  <div class="box-photo product-image-container ejs-box-photo ejs-product-image-container"
       data-product-url="/blanks-by-series/rx6-e-glass-jig-boat"></div>
  <div class="box-info">
    <ul class="unstyled">
      <li class="product-title"><a href="/blanks-by-series/rx6-e-glass-jig-boat" class="product-title">RX6 / E Glass - Jig / Boat</a></li>
    </ul>
  </div>
  <div class="box-price"><a class="btn btn-primary" href="/blanks-by-series/rx6-e-glass-jig-boat">See All Items</a></div>
</div>

<div class="ejs-productitem span3">
  <div class="box-photo product-image-container ejs-box-photo ejs-product-image-container"
       data-product-url="/blanks-by-series/rx6-e-glass-tuna-popper-rx6-e-glass-tuna-popper"></div>
  <div class="box-info">
    <ul class="unstyled">
      <li class="product-title"><a href="/blanks-by-series/rx6-e-glass-tuna-popper-rx6-e-glass-tuna-popper" class="product-title">RX6 / E Glass - Tuna Popper</a></li>
    </ul>
  </div>
  <div class="box-price"><a class="btn btn-primary" href="/blanks-by-series/rx6-e-glass-tuna-popper-rx6-e-glass-tuna-popper">See All Items</a></div>
</div>
`

describe('crawlBatsonBlanksbySeries', () => {
  it('extracts unique absolute series URLs from blanks-by-series grid', () => {
    const urls = crawlBatsonBlanksbySeries(FIXTURE_HTML, BASE)
    const expected = [
      `${BASE}/blanks-by-series/solid-glass-heavy-duty`,
      `${BASE}/blanks-by-series/rx6-e-glass-jig-boat`,
      `${BASE}/blanks-by-series/rx6-e-glass-tuna-popper-rx6-e-glass-tuna-popper`,
    ]
    // must include all expected
    expected.forEach(u => expect(urls).toContain(u))
    // no duplicates
    expect(new Set(urls).size).toBe(urls.length)
    // sanity: all absolute + correct host
    urls.forEach(u => expect(u.startsWith(`${BASE}/blanks-by-series/`)).toBe(true))
  })
})
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
