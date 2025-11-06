import { describe, it, expect } from 'vitest'
import { buildBatsonTitle } from '../lib/titleBuild/batson'

describe('buildBatsonTitle', () => {
  it('dedupes adjacent tokens across series/material', () => {
    const title = buildBatsonTitle({
      title: 'Raw Title',
      rawSpecs: { series: 'Immortal RX8', material: 'RX8 Graphite' },
    })
    expect(title).toContain('Immortal RX8 Graphite')
  })

  it('formats length from inches, pieces and power', () => {
    const title = buildBatsonTitle({
      rawSpecs: { length_in: 94, series: 'Immortal RX8', material: 'RX8 Graphite', pieces: 2, power: 'mh' },
    })
    expect(title).toContain('7\'10"')
    expect(title).toContain('2pc')
    expect(title).toContain('MH')
  })

  it('uses color cleaned of suffix', () => {
    const title = buildBatsonTitle({ rawSpecs: { color: 'Matte Black Color' } })
    expect(title.endsWith('Matte Black')).toBe(true)
  })
})
