import { describe, expect, it } from 'vitest'
import { extractBatsonAttributeGrid } from '../batsonAttributeGrid'

const html = `
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
    const res = extractBatsonAttributeGrid(html)
    expect(res.rows.length).toBe(1)
    const spec = res.rows[0].spec
    expect(spec.line_lb).toBe('8-12 lbs')
    expect(spec.line_lb_min).toBe(8)
    expect(spec.line_lb_max).toBe(12)
    expect(spec.lure_oz).toBe('1/4-1/2 oz')
    expect(spec.lure_oz_min).toBeCloseTo(0.25, 5)
    expect(spec.lure_oz_max).toBeCloseTo(0.5, 5)
  })
})
