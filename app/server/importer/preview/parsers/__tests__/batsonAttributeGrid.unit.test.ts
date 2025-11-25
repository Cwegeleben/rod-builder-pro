import { describe, expect, it } from 'vitest'
import {
  extractBatsonAttributeGrid,
  extractBatsonDetailMeta,
  extractBatsonInfoAttributes,
  extractPricePairFromRow,
  normalizePricePair,
  resolveBatsonRowPrices,
} from '../batsonAttributeGrid'

const BASE = 'https://batsonenterprises.com/grips'

describe('preview batson attribute grid parser', () => {
  it('captures accessory specs for grips/end caps/trim rows', () => {
    const html = `
      <table class="attribute-grid">
        <thead>
          <tr>
            <th>Code</th><th>Color</th><th>Inside Diameter</th><th>Outside Diameter</th><th>Item Length (in)</th><th>Finish</th><th>Availability</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/grips/rfg-250">RFG-250</a></td>
            <td>Matte Black</td>
            <td>0.250"</td>
            <td>0.500"</td>
            <td>7"</td>
            <td>Gloss</td>
            <td>In Stock</td>
          </tr>
        </tbody>
      </table>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    const specs = rows[0].specs
    expect(specs.color).toBe('Matte Black')
    expect(specs.finish).toBe('Gloss')
    expect(specs.inside_dia_in).toBeCloseTo(0.25, 3)
    expect(specs.outside_dia_in).toBeCloseTo(0.5, 3)
    expect(specs.length_in).toBe(7)
    expect(specs.length_label).toBe('7"')
  })

  it('captures MSRP and wholesale values from price columns when present', () => {
    const html = `
      <table class="attribute-grid">
        <thead>
          <tr><th>Code</th><th>Price</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/rod-blanks/rx7-foo">RX7-FOO</a></td>
            <td>
              <ul class="unstyled">
                <li><strong class="price">USD $25.00</strong> /Each</li>
                <li><small class="muted">MSRP: USD $40.00 /Each</small></li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    expect(rows[0].price).toBeCloseTo(25, 2)
    expect(rows[0].priceMsrp).toBeCloseTo(40, 2)
    expect(rows[0].priceWholesale).toBeCloseTo(25, 2)
  })

  it('normalizes blank specs including length, power, action, and ratings', () => {
    const html = `
      <table class="attribute-grid">
        <tbody>
          <tr>
            <td>IMM-76ML</td>
            <td>Immortal</td>
            <td class="information-attributes">
              <ul>
                <li class="information-attribute">
                  <span class="information-attribute__label">Item Length (in)</span>
                  <span class="information-attribute__text">7' 6"</span>
                </li>
                <li class="information-attribute">
                  <span class="information-attribute__label">Power</span>
                  <span class="information-attribute__text">Medium Light</span>
                </li>
                <li class="information-attribute">
                  <span class="information-attribute__label">Action</span>
                  <span class="information-attribute__text">Fast</span>
                </li>
                <li class="information-attribute">
                  <span class="information-attribute__label">Material</span>
                  <span class="information-attribute__text">RX8 Graphite</span>
                </li>
                <li class="information-attribute">
                  <span class="information-attribute__label">Line Rating (lbs.)</span>
                  <span class="information-attribute__text">8 - 17 lbs.</span>
                </li>
                <li class="information-attribute">
                  <span class="information-attribute__label">Lure Weight Rating (oz.)</span>
                  <span class="information-attribute__text">3/8 - 1 1/4 oz.</span>
                </li>
              </ul>
            </td>
            <td>In Stock</td>
          </tr>
        </tbody>
      </table>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    const specs = rows[0].specs
    expect(specs.length_in).toBe(90)
    expect(specs.length_label).toBe(`7' 6"`)
    expect(specs.power).toBe('Medium Light')
    expect(specs.action).toBe('Fast')
    expect(specs.material).toBe('RX8 Graphite')
    expect(specs.line_rating).toBe('8 - 17 lbs.')
    expect(specs.lure_weight).toBe('3/8 - 1 1/4 oz.')
  })

  it('extracts detail page information-attributes into raw and normalized specs', () => {
    const html = `
      <section>
        <ul class="information-attributes">
          <li class="information-attribute">
            <span class="information-attribute__label">Item Length (in)</span>
            <span class="information-attribute__text">6' 6"</span>
          </li>
          <li class="information-attribute">
            <span class="information-attribute__label">Power</span>
            <span class="information-attribute__text">Medium Heavy</span>
          </li>
          <li class="information-attribute">
            <span class="information-attribute__label">Butt Diameter</span>
            <span class="information-attribute__text">0.500"</span>
          </li>
        </ul>
      </section>
    `
    const detail = extractBatsonInfoAttributes(html)
    expect(detail.raw['Item Length (in)']).toBe(`6' 6"`)
    expect(detail.raw['Power']).toBe('Medium Heavy')
    expect(detail.specs.length_in).toBe(78)
    expect(detail.specs.length_label).toBe(`6' 6"`)
    expect(detail.specs.power).toBe('Medium Heavy')
    expect(detail.specs.butt_dia_in).toBeCloseTo(0.5, 3)
  })

  it('captures MSRP and availability metadata from detail pages', () => {
    const html = `
      <div class="span6">
        <ul class="unstyled">
          <li>
            <strong class="price">USD $22.85</strong> /Each
            <small class="muted">MSRP: USD $47.92 /Each</small>
          </li>
        </ul>
      </div>
      <table class="table attribute-grid">
        <thead>
          <tr><th>Code</th><th>Availability</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>SPJ20C-K</td>
            <td>
              In Stock
              <a class="btn help-icon" data-content="PLEASE NOTE: Add To Cart lives at the bottom."></a>
            </td>
          </tr>
        </tbody>
      </table>
    `
    const meta = extractBatsonDetailMeta(html)
    expect(meta.msrp).toBeCloseTo(47.92, 2)
    expect(meta.priceWholesale).toBeCloseTo(22.85, 2)
    expect(meta.availability).toBe('In Stock')
    expect(meta.availabilityNote).toBe('PLEASE NOTE: Add To Cart lives at the bottom.')
  })

  it('extractBatsonDetailMeta parses inline MSRP + wholesale from single string', () => {
    const html = `
      <div class="box-price">
        <strong class="price">Dealer Cost $18.75 (MSRP $32.90)</strong>
      </div>
    `
    const meta = extractBatsonDetailMeta(html)
    expect(meta.priceWholesale).toBeCloseTo(18.75, 2)
    expect(meta.msrp).toBeCloseTo(32.9, 2)
  })

  it('falls back to detail meta pricing when grid row lacks price data', () => {
    const html = `
      <div class="box-price">
        <strong class="price">USD $45.17</strong>
        <small class="muted">MSRP: USD $75.29</small>
      </div>
      <table class="attribute-grid">
        <thead>
          <tr><th>Code</th><th>Price</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/reel-seats/alps-aluminum-trigger-black-purple">AT16-BPR</a></td>
            <td><span class="muted">See detail section</span></td>
          </tr>
        </tbody>
      </table>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    expect(rows[0].price ?? null).toBeNull()
    expect(rows[0].priceMsrp ?? null).toBeNull()
    expect(rows[0].priceWholesale ?? null).toBeNull()
    const detailMeta = extractBatsonDetailMeta(html)
    const resolved = resolveBatsonRowPrices(rows[0], detailMeta)
    expect(resolved.priceWholesale).toBeCloseTo(45.17, 2)
    expect(resolved.priceMsrp).toBeCloseTo(75.29, 2)
  })

  it('prefers existing row prices over detail-meta values when already present', () => {
    const row = {
      price: 18.5,
      priceMsrp: 32.75,
      priceWholesale: 18.5,
    }
    const detailMeta = {
      msrp: 55,
      priceWholesale: 25,
      availability: null,
      availabilityNote: null,
    }
    const resolved = resolveBatsonRowPrices(row, detailMeta)
    expect(resolved.priceWholesale).toBeCloseTo(18.5, 2)
    expect(resolved.priceMsrp).toBeCloseTo(32.75, 2)
  })

  it('swaps price fields when wholesale exceeds MSRP from detail meta fallback', () => {
    const row = {
      price: null,
      priceMsrp: null,
      priceWholesale: null,
    }
    const detailMeta = {
      msrp: 12.5,
      priceWholesale: 28.1,
      availability: null,
      availabilityNote: null,
    }
    const resolved = resolveBatsonRowPrices(row, detailMeta)
    expect(resolved.priceMsrp).toBeCloseTo(28.1, 2)
    expect(resolved.priceWholesale).toBeCloseTo(12.5, 2)
  })

  it('normalizePricePair enforces MSRP >= wholesale when both present', () => {
    const normalized = normalizePricePair(8.75, 19.33)
    expect(normalized.priceMsrp).toBeCloseTo(19.33, 2)
    expect(normalized.priceWholesale).toBeCloseTo(8.75, 2)
  })

  it('applies header price fallback when rows lack inline pricing', () => {
    const html = `
      <div class="span8">
        <div class="row-fluid">
          <h1>#16 Aluminum Fly Reel Seat w / BP Cap - Blk</h1>
        </div>
        <div class="row-fluid">
          <div class="span6">
            <ul class="unstyled">
              <li><strong class="price">USD $3.74</strong></li>
              <li><small class="muted">MSRP: USD $10.38</small></li>
            </ul>
          </div>
        </div>
        <table class="attribute-grid">
          <thead>
            <tr><th>Code</th><th>Price</th><th>Availability</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><a href="/reel-seats/a16bp-b">A16BP-B</a></td>
              <td><span class="muted">See detail section</span></td>
              <td>In Stock</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.price).toBeCloseTo(3.74, 2)
    expect(row.priceWholesale).toBeCloseTo(3.74, 2)
    expect(row.priceMsrp).toBeCloseTo(10.38, 2)
  })

  it('fills missing wholesale from header price block while keeping row MSRP', () => {
    const html = `
      <div class="span8">
        <div class="row-fluid">
          <h1>#16 Aluminum Fly Reel Seat w / BP Cap - Blk</h1>
        </div>
        <div class="row-fluid">
          <div class="span6">
            <ul class="unstyled">
              <li><strong class="price">Dealer Cost $3.74</strong></li>
              <li><small class="muted">MSRP: USD $10.38</small></li>
            </ul>
          </div>
        </div>
        <table class="attribute-grid">
          <thead>
            <tr><th>Code</th><th>Price</th><th>Availability</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><a href="/reel-seats/a16bp-b">A16BP-B</a></td>
              <td>
                <ul>
                  <li><small class="muted">MSRP: USD $10.38</small></li>
                </ul>
              </td>
              <td>In Stock</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.priceMsrp).toBeCloseTo(10.38, 2)
    expect(row.priceWholesale).toBeCloseTo(3.74, 2)
    expect(row.price).toBeCloseTo(3.74, 2)
  })

  it('overrides duplicated MSRP inline price with header dealer cost', () => {
    const html = `
      <div class="span8">
        <div class="row-fluid">
          <h1>#16 Aluminum Fly Reel Seat w / BP Cap - Blk</h1>
        </div>
        <div class="row-fluid">
          <div class="span6">
            <ul class="unstyled">
              <li><strong class="price">Dealer Cost $3.74</strong></li>
              <li><small class="muted">MSRP: USD $10.38</small></li>
            </ul>
          </div>
        </div>
        <table class="attribute-grid">
          <thead>
            <tr><th>Code</th><th>Price</th><th>Availability</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><a href="/reel-seats/a16bp-b">A16BP-B</a></td>
              <td>
                <strong class="price">USD $10.38</strong>
                <small class="muted">MSRP: USD $10.38</small>
              </td>
              <td>In Stock</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.priceMsrp).toBeCloseTo(10.38, 2)
    expect(row.priceWholesale).toBeCloseTo(3.74, 2)
  })

  it('applies header fallback when table lacks a price column entirely', () => {
    const html = `
      <div class="span8">
        <div class="row-fluid">
          <h1>#16 Aluminum Fly Reel Seat w / BP Cap - Blk</h1>
          <div>
            <ul class="unstyled">
              <li><strong class="price">USD $3.74</strong></li>
              <li><small class="muted">MSRP: USD $10.38</small></li>
            </ul>
          </div>
        </div>
        <table class="attribute-grid">
          <thead>
            <tr><th>Code</th><th>Availability</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><a href="/reel-seats/ra5-ins-rwe">RA5-INS-RWE</a></td>
              <td>In Stock</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    const rows = extractBatsonAttributeGrid(html, BASE)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.priceWholesale).toBeCloseTo(3.74, 2)
    expect(row.priceMsrp).toBeCloseTo(10.38, 2)
  })

  describe('extractPricePairFromRow', () => {
    it('infers MSRP + wholesale from combined cell text with context hints', () => {
      const { priceMsrp, priceWholesale } = extractPricePairFromRow({
        priceText: 'Dealer Cost $18.75 (MSRP $32.90)',
        fallbackTexts: [{ text: 'Dealer Cost $18.75 (MSRP $32.90)' }],
      })
      expect(priceWholesale).toBeCloseTo(18.75, 2)
      expect(priceMsrp).toBeCloseTo(32.9, 2)
    })

    it('respects explicit price numeric but still parses MSRP from muted text', () => {
      const { priceMsrp, priceWholesale } = extractPricePairFromRow({
        priceValue: 22.5,
        priceText: 'USD $22.50 /Each',
        fallbackTexts: [{ text: 'MSRP: USD $40.00 /Each', hint: 'msrp' }],
      })
      expect(priceWholesale).toBeCloseTo(22.5, 2)
      expect(priceMsrp).toBeCloseTo(40, 2)
    })

    it('duplicates MSRP onto wholesale when only MSRP text present', () => {
      const { priceMsrp, priceWholesale } = extractPricePairFromRow({
        fallbackTexts: [{ text: 'MSRP: USD $75.00' }],
      })
      expect(priceMsrp).toBeCloseTo(75, 2)
      expect(priceWholesale).toBeCloseTo(75, 2)
    })
  })
})
