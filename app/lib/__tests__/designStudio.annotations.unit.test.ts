import { describe, it, expect } from 'vitest'
import { deriveDesignStudioAnnotations } from '../designStudio/annotations.server'

describe('deriveDesignStudioAnnotations', () => {
  it('marks blanks ready when family, length, and power are available', () => {
    const result = deriveDesignStudioAnnotations({
      supplierKey: 'batson-rod-blanks',
      partType: 'blank',
      title: 'Eternity RX10 7\'6" ML Fast',
      rawSpecs: { series: 'Eternity RX10', length_in: 90, power: 'ML' },
      normSpecs: { action: 'F' },
    })
    expect(result.ready).toBe(true)
    expect(result.family).toBe('Rainshadow Eternity')
    expect(result.series).toContain('Eternity')
    expect(result.compatibility.lengthIn).toBe(90)
    expect(result.compatibility.power).toBe('ML')
    expect(result.coverageNotes).toBeUndefined()
  })

  it('flags coverage gaps when key specs are missing', () => {
    const result = deriveDesignStudioAnnotations({
      supplierKey: 'batson',
      partType: 'blank',
      title: 'Immortal 8ft',
      rawSpecs: {},
      normSpecs: {},
    })
    expect(result.ready).toBe(false)
    expect(result.coverageNotes).toMatch(/Needs/)
    expect(result.sourceQuality).toBe('auto:needs-review')
  })
})
