import { describe, it, expect } from 'vitest'
import { buildBatsonTitle } from '../lib/titleBuild/batson'

describe('Batson guide kit count & type', () => {
  it('extracts guide count and casting type from dash prefix', () => {
    const t = buildBatsonTitle({
      title: '10-8-6-6 ALPS Casting Guide Kit',
      rawSpecs: { is_kit: true, frame_material: 'stainless steel', finish: 'Black', code: 'GK1401' },
    })
    expect(t).toMatch(/Casting Guide Kit \(4 Guides\)/)
    expect(t).not.toMatch(/GK1401/) // code removed
  })

  it('falls back to numeric tokens pre-brand when no dash prefix', () => {
    const t = buildBatsonTitle({
      title: '7 6 6 6 Forecast Spinning Guide Kit',
      rawSpecs: { is_kit: true, finish: 'Polished', frame_material: 'stainless steel', code: 'GK2501' },
    })
    expect(t).toMatch(/Spinning Guide Kit \(4 Guides\)/)
  })
})
