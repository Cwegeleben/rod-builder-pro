import { describe, expect, it } from 'vitest'
import {
  normalizeBatsonBlank,
  normalizeBatsonGuide,
  normalizeBatsonProduct,
  normalizeBatsonTipTop,
} from '../batsonNormalize.server'

const baseRawSpecs = {
  series: 'RX7',
  applications: 'Casting, Freshwater',
  length_in: '84',
  pieces: '1',
  power: 'MH',
  action: 'F',
  line_lb: '10-17',
  lure_oz: '1/4-1',
  tip_top_size: '4.5',
  butt_dia_in: '0.54',
  weight_oz: '1.9',
  material: 'RX7 Graphite',
}

describe('batsonNormalize blank', () => {
  it('builds canonical blank fields', () => {
    const normalized = normalizeBatsonBlank({
      externalId: 'IMMWS84MH',
      partType: 'Rod Blank',
      title: 'RainShadow IMMWS84MH Casting Blank',
      description: 'RX7 all-around casting blank',
      rawSpecs: { ...baseRawSpecs },
      availability: 'In Stock',
      priceMsrp: 189.99,
      images: ['https://example.com/blank.jpg'],
    })
    expect(normalized.family).toBe('castingBlank')
    expect(normalized.itemTotalLengthIn).toBe(84)
    expect(normalized.numberOfPieces).toBe(1)
    expect(normalized.lineRating).toContain('10-17')
    expect(normalized.tipOD_mm).toBeCloseTo(4.5, 2)
    expect(normalized.materialConstruction).toContain('RX7')
    expect(normalized.category).toBe('blank')
    expect(normalized.designStudioRole).toBe('BLANK')
    expect(normalized.imageUrl).toBe('https://example.com/blank.jpg')
  })
})

describe('batsonNormalize guide', () => {
  it('emits Design Studio metadata for guides', () => {
    const normalized = normalizeBatsonGuide({
      externalId: 'MXN5',
      partType: 'Guide',
      title: 'ALPS MXN5 Single Foot Guide',
      description: 'Size 5 running guide',
      rawSpecs: {
        ring_size: '5',
        frame_material: 'SS316',
        ring_material: 'SIC',
        finish: 'TiChrome',
        height_mm: '15',
        weight_oz: '0.05',
        foot_type: 'single',
      },
      priceMsrp: 5.25,
      images: ['https://cdn.rbp.dev/samples/mxn-5.jpg'],
    })
    expect(normalized.category).toBe('guide')
    expect(normalized.designStudioRole).toBe('GUIDE')
    expect(normalized.imageUrl).toBe('https://cdn.rbp.dev/samples/mxn-5.jpg')
    expect(normalized.frameMaterial).toMatch(/316/i)
    expect(normalized.ringMaterial).toMatch(/carbide/i)
  })
})

describe('batsonNormalize tip tops', () => {
  it('derives tube/ring sizes and title', () => {
    const normalized = normalizeBatsonTipTop({
      externalId: 'FSTT4.5-6',
      partType: 'Tip Top',
      title: 'ALPS FSTT 4.5 Tube #6 Ring',
      description: 'Forecast heavy duty tip top',
      rawSpecs: {
        tube_size: '4.5',
        ring_size: '6',
        frame_material: 'SS316',
        ring_material: 'SIC',
      },
    })
    expect(normalized.tubeSize).toBeCloseTo(4.5, 1)
    expect(normalized.ringSize).toBe(6)
    expect(normalized.displayName).toMatch(/Tip Top/)
    expect(normalized.frameMaterial).toMatch(/316/i)
    expect(normalized.category).toBe('tipTop')
    expect(normalized.designStudioRole).toBe('TIP_TOP')
    expect(normalized.loopStyle).toBe('fly')
    expect(normalized.family).toBe('flyTipTop')
    expect(normalized.tipTop?.tubeSizeMm).toBeCloseTo(4.5, 1)
    expect(normalized.tipTop?.ringSize).toBe(6)
  })
})

describe('batsonNormalize router', () => {
  it('routes guide inputs to the guide normalizer', () => {
    const normalized = normalizeBatsonProduct({
      externalId: 'MXN5',
      partType: 'Guide',
      title: 'ALPS MXN5 Guide',
      rawSpecs: {
        ring_size: '5',
        frame_material: 'SS304',
        ring_material: 'SIC',
        finish: 'Black',
        height_mm: '15',
        weight_oz: '0.05',
      },
    })
    expect(normalized && 'frameMaterial' in normalized ? normalized.frameMaterial : null).toContain('304')
  })
})
