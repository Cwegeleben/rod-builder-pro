import { describe, it, expect } from 'vitest'
import { buildBatsonTitle } from '../lib/titleBuild/batson'

describe('buildBatsonTitle', () => {
  it('dedupes adjacent tokens across series/material', () => {
    const title = buildBatsonTitle({
      title: 'Raw Title',
      rawSpecs: { series: 'Immortal RX8', material: 'RX8 Graphite' },
    })
    expect(title).toContain('Immortal RX8 Blank Graphite')
    expect((title.match(/RX8/g) || []).length).toBe(1)
  })

  it('formats length from inches, pieces and power', () => {
    const title = buildBatsonTitle({
      rawSpecs: { length_in: 94, series: 'Immortal RX8', material: 'RX8 Graphite', pieces: 2, power: 'mh' },
    })
    expect(title).toContain('7\'10"')
    expect(title).toContain('2pc')
    expect(title).toContain('MH')
  })

  it('includes RainShadow branding and blank role when implied by series', () => {
    const title = buildBatsonTitle({
      rawSpecs: {
        length_in: 90,
        pieces: 1,
        series: 'Revelation',
        application: 'Spinning',
        power: 'M',
        action: 'Fast',
        line_lb: '6-12',
      },
    })
    expect(title).toContain('RainShadow')
    expect(title).toContain('Spinning Blank')
    expect(title).toContain('Line 6-12lb')
  })

  it('does not fall back to Batson when no brand token is detected', () => {
    const title = buildBatsonTitle({
      rawSpecs: {
        length_in: 84,
        pieces: 2,
        power: 'ML',
      },
    })
    expect(title.toLowerCase()).not.toContain('batson')
  })

  it('uses color cleaned of suffix', () => {
    const title = buildBatsonTitle({ rawSpecs: { color: 'Matte Black Color' } })
    expect(title.endsWith('Matte Black')).toBe(true)
  })

  it('builds guide kit titles with brand, type, and count', () => {
    const title = buildBatsonTitle({
      title: '10-8-7-6-5-4-4-4 Casting Kit',
      rawSpecs: {
        is_kit: true,
        externalId: 'MXN-KIT-CAST',
        frame_material: 'SS316',
        finish: 'TiChrome',
        original_title: '10-8-7-6-5-4-4-4 Alps Casting Kit',
      },
    })
    expect(title).toContain('Alps')
    expect(title).toContain('Guide Kit')
    expect(title).toContain('(8 Guides)')
  })

  it('describes tip tops with type, material, and tube spec', () => {
    const title = buildBatsonTitle({
      partType: 'Tip Top',
      rawSpecs: {
        tube_size: 5.5,
        color: 'Polished Stainless',
        frame_material: 'Titanium',
        ring_size: 10,
        ring_material: 'SiC',
      },
    })
    expect(title).toBe('Standard Tip Top Titanium 5.5 Tube – Silicon Carbide 10 Ring')
  })

  it('formats reel seats with tube and finish', () => {
    const title = buildBatsonTitle({
      partType: 'Reel Seat',
      rawSpecs: {
        series: 'ALPS SX',
        seat_type: 'Casting',
        tube_size: 16,
        material: 'Aluminum',
        finish: 'Matte Black',
      },
    })
    expect(title.startsWith('Alps SX')).toBe(true)
    expect(title).toContain('Reel Seat')
    expect(title).toContain('16mm Tube')
    expect(title).toContain('Matte Black')
  })

  it('includes inch measurements for grips', () => {
    const title = buildBatsonTitle({
      partType: 'Rear Grip',
      rawSpecs: {
        grip_type: 'Rear Grip',
        length: 9,
        inner_diameter: 0.25,
        outer_diameter: 1,
        material: 'EVA Foam',
        color: 'Royal Blue Color',
      },
    })
    expect(title).toContain('Grip')
    expect(title).toContain('9" Length')
    expect(title).toContain('0.25" ID')
    expect(title).toContain('Eva Foam')
    expect(title).toContain('Royal Blue')
  })

  it('labels end caps with ID/OD dimensions', () => {
    const title = buildBatsonTitle({
      partType: 'Gimbal Cap',
      rawSpecs: {
        part_type: 'Gimbal Cap',
        inner_diameter: 0.8,
        outer_diameter: 1.2,
        length: 2,
        material: 'Aluminum',
        color: 'Matte Black',
      },
    })
    expect(title).toContain('Gimbal Cap')
    expect(title).toContain('0.8" ID')
    expect(title).toContain('1.2" OD')
    expect(title).toContain('Matte Black')
  })

  it('names trim components with dimensions', () => {
    const title = buildBatsonTitle({
      partType: 'Trim Ring',
      rawSpecs: {
        part_type: 'Winding Check',
        inner_diameter: 0.3,
        outer_diameter: 0.6,
        thickness: 0.1,
        material: 'Aluminum',
        color: 'PVD Black',
      },
    })
    expect(title).toContain('Trim')
    expect(title).toContain('0.3" ID')
    expect(title).toContain('0.1" Length')
    expect(title).toContain('PVD Black')
  })
})
