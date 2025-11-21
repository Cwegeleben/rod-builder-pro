import { describe, it, expect } from 'vitest'
import { buildBatsonTitle } from '../lib/titleBuild/batson'

describe('Batson guide/tip-top brand + family title formatting', () => {
  it('includes brand and family for guide code prefix with descriptor', () => {
    const t = buildBatsonTitle({
      title: 'Alps MXN Guide',
      rawSpecs: { ring_size: 10, finish: 'Polished', code: 'MXN10-POL' },
    })
    expect(t).toMatch(/^Alps MXN Guide Ring 10 Polished( - Stainless Steel Frame)?$/)
  })

  it('includes brand and family for tip top with descriptor', () => {
    const t = buildBatsonTitle({
      title: 'Forecast Tip Top',
      rawSpecs: { tube_size: 6.0, color: 'Gunsmoke', code: 'TT06GS' },
    })
    expect(t).toMatch(/^Forecast TT Tip Top Tube 6mm Gunsmoke( - Stainless Steel Frame)?$/)
  })

  it('suppresses GK family for kits but keeps brand fallback', () => {
    const t = buildBatsonTitle({
      title: 'Alps Guide Kit',
      rawSpecs: { is_kit: true, frame_material: 'stainless steel', finish: 'Black', code: 'GK1401' },
    })
    // GK should not appear as family; brand + Guide Kit + frame + finish + code
    expect(t).toMatch(/^Alps Guide Kit Stainless Steel Black$/)
  })
})
