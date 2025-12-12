import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NormalizedBlank,
  NormalizedGuide,
  NormalizedGrip,
  NormalizedReelSeat,
  NormalizedTipTop,
  NormalizedEndCap,
  NormalizedTrim,
} from '../../../domain/catalog/batsonNormalizedTypes'

const mockUpsert = vi.fn()
const mockUpdateMany = vi.fn()
const mockProductUpdate = vi.fn()
const mockProductVersionFindFirst = vi.fn()
const mockProductVersionCreate = vi.fn()
const mockSupplierFindUnique = vi.fn()

vi.mock('../../../db.server', () => ({
  prisma: {
    product: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockProductUpdate(...args),
    },
    productVersion: {
      findFirst: (...args: unknown[]) => mockProductVersionFindFirst(...args),
      create: (...args: unknown[]) => mockProductVersionCreate(...args),
    },
    supplier: {
      findUnique: (...args: unknown[]) => mockSupplierFindUnique(...args),
    },
  },
}))

describe('batsonApply', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUpsert.mockResolvedValue({ id: 'product-1' })
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockProductUpdate.mockResolvedValue({})
    mockProductVersionFindFirst.mockResolvedValue({ id: 'version-existing' })
    mockProductVersionCreate.mockResolvedValue({ id: 'version-new' })
    mockSupplierFindUnique.mockResolvedValue({ slug: 'batson' })
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
      imageUrl: 'https://example.com/immws84mh.jpg',
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
    expect(mapped.designStudioRole).toBe('BLANK')
    const heroImage = Array.isArray(mapped.images) ? mapped.images[0] : null
    expect(heroImage).toBe('https://example.com/immws84mh.jpg')
    expect(mapped.designStudioReady).toBe(true)
  })

  it('maps normalized guide records with DS metadata and readiness gate', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedGuide = {
      productCode: 'MXN5',
      brand: 'ALPS',
      series: 'MXN',
      family: 'singleFootGuide',
      material: 'Stainless',
      msrp: 5.25,
      availability: 'inStock',
      color: 'TiChrome',
      imageUrl: 'https://example.com/mxn5.jpg',
      category: 'guide',
      designStudioRole: 'GUIDE',
      frameMaterial: 'Stainless 316',
      frameMaterialCode: 'SS316',
      frameFinish: 'TiChrome',
      ringMaterial: 'Silicon Carbide',
      ringMaterialCode: 'SIC',
      ringSize: 5,
      footType: 'single',
      height_mm: 15.2,
      weightOz: 0.05,
      footLength_mm: 8.1,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-guides-tops',
      title: 'ALPS MXN5 Guide',
      description: 'Single foot guide',
      normalized,
    })

    expect(mapped.category).toBe('guide')
    expect(mapped.designStudioRole).toBe('GUIDE')
    expect(mapped.designStudioReady).toBe(true)
    const attrs = mapped.attributes as Record<string, unknown>
    expect(attrs?.ringSize).toBe(5)
  })

  it('keeps guides blocked when contract fields are missing', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedGuide = {
      productCode: 'MXN6',
      brand: 'ALPS',
      series: 'MXN',
      family: 'singleFootGuide',
      material: 'Stainless',
      msrp: 5.5,
      availability: 'inStock',
      color: 'Black',
      imageUrl: 'https://example.com/mxn6.jpg',
      category: 'guide',
      designStudioRole: 'GUIDE',
      frameMaterial: 'Stainless 316',
      frameMaterialCode: 'SS316',
      frameFinish: 'Black',
      ringMaterial: '',
      ringMaterialCode: undefined,
      ringSize: 6,
      footType: 'single',
      height_mm: 16,
      weightOz: 0.06,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-guides-tops',
      title: 'ALPS MXN6 Guide',
      normalized,
    })

    expect(mapped.designStudioReady).toBe(false)
  })

  it('maps normalized tip top records with DS metadata and helper payload', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedTipTop = {
      productCode: 'ALPS-TOP-55',
      brand: 'ALPS',
      series: 'Titanium',
      family: 'castingTipTop',
      material: 'Titanium',
      msrp: 12.5,
      availability: 'inStock',
      color: 'Polished',
      category: 'tipTop',
      designStudioRole: 'TIP_TOP',
      imageUrl: 'https://example.com/top.jpg',
      frameMaterial: 'Titanium',
      frameMaterialCode: 'TI',
      frameFinish: 'Polished',
      ringMaterial: 'Silicon Carbide',
      ringMaterialCode: 'SIC',
      ringSize: 6,
      tubeSize: 5.5,
      tipTopType: 'Heavy Duty',
      loopStyle: 'heavy-duty',
      displayName: 'Heavy Duty Tip Top — Silicon Carbide Ring',
      tipTop: {
        tipTopType: 'Heavy Duty',
        familyHint: 'castingTipTop',
        loopStyle: 'heavy-duty',
        frameMaterialCode: 'TI',
        frameMaterialLong: 'Titanium',
        ringMaterialCode: 'SIC',
        ringMaterialLong: 'Silicon Carbide',
        tubeSizeMm: 5.5,
        ringSize: 6,
        title: 'Heavy Duty Tip Top — Silicon Carbide Ring',
      },
      weightOz: 0.08,
      height_mm: 28,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-guides-tops',
      title: 'ALPS Titanium Size 6 / 5.5 Tube Tip Top',
      description: 'Titanium tip top',
      normalized,
    })

    expect(mapped.category).toBe('tipTop')
    expect(mapped.designStudioRole).toBe('TIP_TOP')
    expect(mapped.designStudioReady).toBe(true)
    const attrs = mapped.attributes as Record<string, unknown>
    expect(attrs?.loopStyle).toBe('heavy-duty')
    expect(attrs?.tipTop).toMatchObject({ ringSize: 6, tubeSizeMm: 5.5 })
  })

  it('keeps tip tops blocked when missing tube size', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedTipTop = {
      productCode: 'ALPS-TOP-00',
      brand: 'ALPS',
      series: 'Forecast',
      family: 'spinningTipTop',
      material: 'Stainless',
      msrp: 8.25,
      availability: 'inStock',
      color: 'Polished',
      category: 'tipTop',
      designStudioRole: 'TIP_TOP',
      imageUrl: 'https://example.com/top-missing.jpg',
      frameMaterial: 'Stainless',
      frameFinish: 'Chrome',
      ringMaterial: 'Hardloy',
      ringSize: 5,
      tubeSize: 0,
      tipTopType: 'Standard',
      loopStyle: 'standard',
      displayName: 'Standard Tip Top — Hardloy Ring',
      tipTop: {
        tipTopType: 'Standard',
        familyHint: 'spinningTipTop',
        loopStyle: 'standard',
        frameMaterialLong: 'Stainless',
        ringMaterialLong: 'Hardloy',
        tubeSizeMm: null,
        ringSize: 5,
        title: 'Standard Tip Top — Hardloy Ring',
      },
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-guides-tops',
      title: 'Forecast Standard Tip Top',
      normalized,
    })

    expect(mapped.designStudioReady).toBe(false)
  })

  it('maps reel seat records with DS metadata and readiness gate', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedReelSeat = {
      productCode: 'RS17-UL',
      brand: 'ALPS',
      series: 'RPD',
      family: 'spinningSeat',
      material: 'Aluminum',
      msrp: 42,
      availability: 'inStock',
      color: 'Matte Black',
      category: 'reelSeat',
      designStudioRole: 'REEL_SEAT',
      imageUrl: 'https://example.com/rs17.jpg',
      seatSize: '17',
      itemLengthIn: 4.5,
      insideDiameterIn: 0.42,
      bodyOutsideDiameterIn: 0.9,
      seatOrientation: 'upLock',
      hoodOutsideDiameterIn: 1,
      insertMaterial: 'Graphite',
      threadSpec: 'M16x1',
      hardwareFinish: 'Matte Black',
      weightOz: 1.3,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-reel-seats',
      title: 'ALPS Size 17 Seat',
      normalized,
    })

    expect(mapped.category).toBe('reelSeat')
    expect(mapped.designStudioRole).toBe('REEL_SEAT')
    expect(mapped.designStudioReady).toBe(true)
    const attrs = mapped.attributes as Record<string, unknown>
    expect(attrs?.seatSize).toBe('17')
    expect(attrs?.insideDiameterIn).toBe(0.42)
  })

  it('keeps reel seats blocked when bore ID is missing', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedReelSeat = {
      productCode: 'RS17-NO-ID',
      brand: 'ALPS',
      series: 'RPD',
      family: 'spinningSeat',
      material: 'Aluminum',
      msrp: 40,
      availability: 'inStock',
      color: 'Matte',
      category: 'reelSeat',
      designStudioRole: 'REEL_SEAT',
      imageUrl: 'https://example.com/rs17-missing.jpg',
      seatSize: '17',
      itemLengthIn: 4.2,
      insideDiameterIn: 0,
      bodyOutsideDiameterIn: 0.85,
      seatOrientation: 'upLock',
      hoodOutsideDiameterIn: 0.95,
      insertMaterial: 'Graphite',
      threadSpec: 'M16x1',
      hardwareFinish: 'Matte',
      weightOz: 1.1,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-reel-seats',
      title: 'ALPS Seat Missing Bore',
      normalized,
    })

    expect(mapped.designStudioReady).toBe(false)
  })

  it('maps trim pieces with component role + readiness gate', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedTrim = {
      productCode: 'TRIM-RING-XL',
      brand: 'ALPS',
      series: 'Trim Ring',
      family: 'trimRing',
      material: 'Aluminum',
      msrp: 7.25,
      availability: 'inStock',
      color: 'TiChrome',
      imageUrl: 'https://example.com/trim-ring.jpg',
      category: 'trim',
      designStudioRole: 'COMPONENT',
      itemLengthIn: 0.5,
      insideDiameterIn: 0.75,
      outsideDiameterIn: 1.1,
      heightIn: 0.2,
      weightOz: 0.05,
      plating: 'TiChrome',
      pattern: 'Knurled',
      notes: 'Sample trim',
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-trim-pieces',
      title: 'ALPS Trim Ring XL',
      description: 'Decorative trim ring',
      normalized,
    })

    expect(mapped.category).toBe('trim')
    expect(mapped.designStudioRole).toBe('COMPONENT')
    expect(mapped.designStudioReady).toBe(true)
    const attrs = mapped.attributes as Record<string, unknown>
    expect(attrs?.insideDiameterIn).toBe(0.75)
    expect(attrs?.plating).toBe('TiChrome')
  })

  it('keeps trim pieces blocked when dimensions are missing', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedTrim = {
      productCode: 'HOOK-KEEPER',
      brand: 'Forecast',
      series: 'Hook Keeper',
      family: 'hookKeeper',
      material: 'Stainless',
      msrp: 4.25,
      availability: 'inStock',
      color: 'Polished',
      imageUrl: 'https://example.com/hook.jpg',
      category: 'trim',
      designStudioRole: 'COMPONENT',
      itemLengthIn: 0.25,
      insideDiameterIn: 0,
      outsideDiameterIn: 0,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-trim-pieces',
      title: 'Forecast Hook Keeper',
      normalized,
    })

    expect(mapped.designStudioReady).toBe(false)
  })

  it('maps end cap records with DS metadata and readiness gate', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedEndCap = {
      productCode: 'BC-28-AL',
      brand: 'ALPS',
      series: 'Gimbal',
      family: 'aluminumCap',
      material: 'Aluminum',
      msrp: 18.5,
      availability: 'inStock',
      color: 'Gunmetal',
      category: 'endCap',
      designStudioRole: 'BUTT_CAP',
      imageUrl: 'https://example.com/bc-28.jpg',
      itemLengthIn: 2,
      insideDiameterIn: 0.85,
      outsideDiameterIn: 1.4,
      endCapDepthIn: 1.2,
      weightOz: 1,
      hardwareInterface: 'press-fit',
      capStyle: 'aluminumCap',
      isGimbal: false,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-end-caps-gimbals',
      title: 'ALPS Aluminum Butt Cap',
      normalized,
    })

    expect(mapped.category).toBe('endCap')
    expect(mapped.designStudioRole).toBe('BUTT_CAP')
    expect(mapped.designStudioReady).toBe(true)
    const attrs = mapped.attributes as Record<string, unknown>
    expect(attrs?.capStyle).toBe('aluminumCap')
    expect(attrs?.isGimbal).toBe(false)
  })

  it('keeps end caps blocked when required specs are missing', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedEndCap = {
      productCode: 'GIMBAL-NO-ID',
      brand: 'ALPS',
      series: 'Gimbal',
      family: 'gimbal',
      material: 'Aluminum',
      msrp: 26,
      availability: 'inStock',
      color: 'Silver',
      category: 'endCap',
      designStudioRole: 'BUTT_CAP',
      itemLengthIn: 0,
      insideDiameterIn: 0,
      outsideDiameterIn: 1.6,
      endCapDepthIn: 1.4,
      capStyle: 'gimbal',
      isGimbal: true,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-end-caps-gimbals',
      title: 'ALPS Gimbal Missing Bore',
      normalized,
    })

    expect(mapped.designStudioReady).toBe(false)
  })

  it('maps grip records with DS metadata and readiness gate', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedGrip = {
      productCode: 'EVA-REAR-10',
      brand: 'Forecast',
      series: 'EVA',
      family: 'rearGrip',
      material: 'EVA',
      msrp: 14.99,
      availability: 'inStock',
      color: 'Black',
      category: 'grip',
      designStudioRole: 'HANDLE',
      imageUrl: 'https://example.com/eva-rear.jpg',
      itemLengthIn: 10,
      insideDiameterIn: 0.35,
      frontODIn: 1,
      rearODIn: 1.05,
      profileShape: 'straight',
      gripPosition: 'rear',
      weight_g: 30,
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-grips',
      title: 'Forecast EVA Rear Grip 10"',
      normalized,
    })

    expect(mapped.category).toBe('grip')
    expect(mapped.designStudioRole).toBe('HANDLE')
    expect(mapped.designStudioReady).toBe(true)
    const attrs = mapped.attributes as Record<string, unknown>
    expect(attrs?.gripPosition).toBe('rear')
  })

  it('keeps grips blocked when required specs are missing', async () => {
    const { mapNormalizedProduct } = await import('../batsonApply.server')
    const normalized: NormalizedGrip = {
      productCode: 'EVA-FORE-MISSING',
      brand: 'Forecast',
      series: 'EVA',
      family: 'foreGrip',
      material: 'EVA',
      msrp: 9.99,
      availability: 'inStock',
      color: 'Black',
      category: 'grip',
      designStudioRole: 'HANDLE',
      itemLengthIn: 4.5,
      insideDiameterIn: 0,
      frontODIn: 0.95,
      rearODIn: 0,
      profileShape: '',
      gripPosition: 'fore',
    }

    const mapped = mapNormalizedProduct({
      supplierId: 'batson',
      supplierSiteId: 'batson-grips',
      title: 'Forecast EVA Fore Grip (incomplete)',
      normalized,
    })

    expect(mapped.designStudioReady).toBe(false)
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
      imageUrl: 'https://example.com/rx6.jpg',
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
    mockUpsert.mockResolvedValue({ id: 'product-blank' })
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
    expect(mockProductUpdate).toHaveBeenCalled()
  })

  it('creates a ProductVersion snapshot for ready reel seats', async () => {
    const { applyBatsonProducts } = await import('../batsonApply.server')
    const normalized: NormalizedReelSeat = {
      productCode: 'RS17-PRO',
      brand: 'ALPS',
      series: 'RPD',
      family: 'spinningSeat',
      material: 'Aluminum',
      msrp: 48,
      availability: 'inStock',
      color: 'Matte Black',
      category: 'reelSeat',
      designStudioRole: 'REEL_SEAT',
      imageUrl: 'https://example.com/rs17-pro.jpg',
      seatSize: '17',
      itemLengthIn: 4.6,
      insideDiameterIn: 0.43,
      bodyOutsideDiameterIn: 0.92,
      seatOrientation: 'upLock',
      hoodOutsideDiameterIn: 1.05,
      insertMaterial: 'Graphite',
      threadSpec: 'M16x1',
      hardwareFinish: 'Matte Black',
      weightOz: 1.2,
    }
    mockSupplierFindUnique.mockResolvedValue({ slug: 'batson' })
    mockUpsert.mockResolvedValue({ id: 'product-seat' })
    mockProductVersionFindFirst.mockResolvedValueOnce(null)
    mockProductVersionCreate.mockResolvedValue({ id: 'version-seat' })

    const result = await applyBatsonProducts([
      {
        supplierId: 'batson',
        supplierSiteId: 'batson-reel-seats',
        title: 'ALPS Size 17 Seat',
        normalized,
      },
    ])

    expect(result).toEqual({ upserts: 1, deactivated: 0 })
    expect(mockProductVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'product-seat',
          designStudioRole: 'reel_seat',
          normSpecs: expect.objectContaining({ seatSize: '17' }),
        }),
      }),
    )
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-seat' },
        data: expect.objectContaining({ latestVersionId: 'version-seat' }),
      }),
    )
  })

  it('creates a ProductVersion snapshot for ready grips', async () => {
    const { applyBatsonProducts } = await import('../batsonApply.server')
    const normalized: NormalizedGrip = {
      productCode: 'WC-REAR-10',
      brand: 'ALPS',
      series: 'WINN',
      family: 'winnGrip',
      material: 'WINN Polymer',
      msrp: 24.5,
      availability: 'inStock',
      color: 'Black/Blue',
      category: 'grip',
      designStudioRole: 'HANDLE',
      imageUrl: 'https://example.com/winn-rear.jpg',
      itemLengthIn: 10,
      insideDiameterIn: 0.34,
      frontODIn: 1,
      rearODIn: 1.1,
      profileShape: 'tapered',
      gripPosition: 'rear',
      weight_g: 32,
    }
    mockUpsert.mockResolvedValue({ id: 'product-grip' })
    mockProductVersionFindFirst.mockResolvedValueOnce(null)
    mockProductVersionCreate.mockResolvedValue({ id: 'version-grip' })

    const result = await applyBatsonProducts([
      {
        supplierId: 'batson',
        supplierSiteId: 'batson-grips',
        title: 'WINN Carbon Rear Grip',
        normalized,
      },
    ])

    expect(result).toEqual({ upserts: 1, deactivated: 0 })
    expect(mockProductVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'product-grip',
          designStudioRole: 'handle',
          designStudioCompatibility: expect.objectContaining({ gripPosition: 'rear' }),
        }),
      }),
    )
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-grip' },
        data: expect.objectContaining({ latestVersionId: 'version-grip' }),
      }),
    )
  })

  it('creates a ProductVersion snapshot for ready end caps', async () => {
    const { applyBatsonProducts } = await import('../batsonApply.server')
    const normalized: NormalizedEndCap = {
      productCode: 'GIMBAL-30-AL',
      brand: 'ALPS',
      series: 'Gimbal',
      family: 'gimbal',
      material: 'Aluminum',
      msrp: 28,
      availability: 'inStock',
      color: 'Silver',
      category: 'endCap',
      designStudioRole: 'BUTT_CAP',
      imageUrl: 'https://example.com/gimbal-30.jpg',
      itemLengthIn: 2.5,
      insideDiameterIn: 0.95,
      outsideDiameterIn: 1.6,
      endCapDepthIn: 1.5,
      weightOz: 1.2,
      hardwareInterface: 'pinned',
      capStyle: 'gimbal',
      isGimbal: true,
    }
    mockUpsert.mockResolvedValue({ id: 'product-endcap' })
    mockProductVersionFindFirst.mockResolvedValueOnce(null)
    mockProductVersionCreate.mockResolvedValue({ id: 'version-endcap' })

    const result = await applyBatsonProducts([
      {
        supplierId: 'batson',
        supplierSiteId: 'batson-end-caps-gimbals',
        title: 'ALPS Aluminum Gimbal 30',
        normalized,
      },
    ])

    expect(result).toEqual({ upserts: 1, deactivated: 0 })
    expect(mockProductVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'product-endcap',
          designStudioRole: 'butt_cap',
          designStudioCompatibility: expect.objectContaining({ capStyle: 'gimbal', insideDiameterIn: 0.95 }),
        }),
      }),
    )
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-endcap' },
        data: expect.objectContaining({ latestVersionId: 'version-endcap' }),
      }),
    )
  })
})
