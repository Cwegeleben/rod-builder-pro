import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedBlank } from '../../../domain/catalog/batsonNormalizedTypes'

const mockUpsert = vi.fn()
const mockUpdateMany = vi.fn()

vi.mock('../../../db.server', () => ({
  prisma: {
    product: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

describe('batsonApply', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('maps normalized blank records to canonical product rows', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedBlank = {
      productCode: 'IMMWS84MH',
      brand: 'RainShadow',
      series: 'Revelation',
      family: 'castingBlank',
      material: 'RX7 Graphite',
      msrp: 189.99,
      availability: 'inStock',
      color: 'Matte',
      itemTotalLengthIn: 84,
      numberOfPieces: 1,
      power: 'MH',
      action: 'F',
      application: ['casting'],
      blankType: 'casting',
      materialConstruction: 'RX7 Graphite',
      lineRating: '10-17 lb',
      lureRating: '1/4-1 oz',
      tipOD_mm: 4.5,
      buttOD_mm: 13.5,
      blankWeightOz: 1.9,
      intrinsicPower_g: 520,
      actionAngle_deg: 78,
      ern: 12,
      tenInDiameter_mm: 9.5,
      twentyInDiameter_mm: 11.2,
      thirtyInDiameter_mm: 12.4,
      finish: 'Gloss',
      notes: 'Sample',
      suitableFor: ['bass'],
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-rod-blanks',
      title: 'RainShadow IMMWS84MH',
      description: 'RX7 casting blank',
      normalized,
    })

    expect(mapped.category).toBe('blank')
    expect(mapped.productCode).toBe('IMMWS84MH')
    expect(mapped.msrp?.toString()).toBe('189.99')
    const attributes = mapped.attributes as Record<string, unknown> | null
    expect(attributes?.power).toBe('MH')
    expect(attributes?.tipOD_mm).toBe(4.5)
    expect(mapped.designStudioReady).toBe(true)
  })

  it('upserts rows and optionally mirrors inactive SKUs', async () => {
    const { applyBatsonProducts } = await import('../batsonApply.server')
    const normalized: NormalizedBlank = {
      productCode: 'RX6-66ML',
      brand: 'RainShadow',
      series: 'RX6',
      family: 'spinningBlank',
      material: 'RX6 Graphite',
      msrp: 139.5,
      availability: 'inStock',
      color: 'Clear',
      itemTotalLengthIn: 78,
      numberOfPieces: 1,
      power: 'ML',
      action: 'F',
      application: ['spinning'],
      blankType: 'blank',
      materialConstruction: 'RX6 Graphite',
      lineRating: '6-12 lb',
      lureRating: '1/4-5/8 oz',
      tipOD_mm: 4,
      buttOD_mm: 12.7,
      blankWeightOz: 1.5,
      intrinsicPower_g: 410,
      actionAngle_deg: 74,
      ern: 10,
      tenInDiameter_mm: 8.9,
      twentyInDiameter_mm: 10.4,
      thirtyInDiameter_mm: 11.7,
      finish: 'Satin',
      notes: undefined,
      suitableFor: ['bass'],
    }
    mockUpsert.mockResolvedValue({})
    mockUpdateMany.mockResolvedValue({ count: 2 })

    const result = await applyBatsonProducts(
      [
        {
          supplierId: 'batson',
          supplierSiteId: 'batson-rod-blanks',
          title: 'RX6 6\'6\" ML',
          normalized,
        },
      ],
      { mirror: true },
    )

    expect(result).toEqual({ upserts: 1, deactivated: 2 })
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const callArgs = mockUpsert.mock.calls[0][0]
    expect(callArgs.create.category).toBe('blank')
    expect(callArgs.create.brand).toBe('RainShadow')
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ supplierId: 'batson' }),
        data: expect.objectContaining({ active: false }),
      }),
    )
  })
})
