import { describe, it, expect } from 'vitest'
import { parseAttributeGrid } from '../../../../src/importer/extractors/batson/parseAttributeGrid'
import { buildBatsonTitle } from '../lib/titleBuild/batson'

const sampleGuidesHtml = `
<table class="attribute-grid">
  <tbody>
    <tr>
      <td>Code</td><td>XYG12-BLK</td>
      <td>Model</td><td>XYZ Guide Series</td>
      <td>Availability</td><td>In Stock</td>
      <td><span class="price">$5.49</span></td>
      <td>
        <ul class="information-attributes">
          <li class="information-attribute"><span class="information-attribute__label">Ring Size</span><span class="information-attribute__text">12</span></li>
          <li class="information-attribute"><span class="information-attribute__label">Frame</span><span class="information-attribute__text">Stainless Steel</span></li>
          <li class="information-attribute"><span class="information-attribute__label">Finish</span><span class="information-attribute__text">Black</span></li>
        </ul>
      </td>
      <td><a href="/products/alps/xyz-guide-12-black">XYZ Guide 12 Black</a></td>
    </tr>
  </tbody>
</table>`

describe('batson guides/tip-tops parsing and title', () => {
  it('parses attribute grid pairs into raw kv', () => {
    const rows = parseAttributeGrid(sampleGuidesHtml)
    expect(rows.length).toBeGreaterThan(0)
    const r0 = rows[0]
    expect(r0.raw['Code']).toBe('XYG12-BLK')
    expect(r0.raw['Model']).toBe('XYZ Guide Series')
  })

  it('builds a guide title using ring size and finish with brand fallback', () => {
    const t = buildBatsonTitle({
      title: 'XYZ Guide',
      rawSpecs: { ring_size: 12, finish: 'Black', code: 'XYG12-BLK' },
    })
    // Family code prefix appears (XYG) before Guide without Batson branding
    expect(t).toMatch(/^XYG Guide Ring 12 Black( - Stainless Steel Frame)?$/i)
  })

  it('builds a tip top title using tube size with brand fallback', () => {
    const t = buildBatsonTitle({
      title: 'Forecast Tip Top',
      rawSpecs: { tube_size: 6.0, color: 'Gunsmoke', code: 'TT06GS' },
    })
    // Family prefix TT precedes type descriptor
    expect(t).toBe('Forecast TT Universal Tip Top Gunsmoke 6mm Tube')
  })

  it('builds a kit title when placeholder title present with brand fallback', () => {
    const t = buildBatsonTitle({
      title: 'Page not found',
      rawSpecs: { is_kit: true, finish: 'Black', code: 'GK3411' },
    })
    expect(t).toMatch(/^Guide Kit Black$/i)
  })
})
