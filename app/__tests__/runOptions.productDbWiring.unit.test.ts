import { describe, test, expect, beforeEach, vi } from 'vitest'

// Feature flag
const OLD_ENV = { ...process.env }

const mockFindMany = vi.fn()
const mockRunFindUnique = vi.fn()
const mockRunUpdate = vi.fn()
const mockDiffDeleteMany = vi.fn()
const mockDiffCount = vi.fn()
const mockDiffCreateMany = vi.fn()
const mockImportLogCreate = vi.fn()
const mockQueryRawUnsafe = vi.fn()

// Mock Prisma client methods used by runOptions.server.ts
vi.mock('../db.server', () => ({
  prisma: {
    partStaging: { findMany: mockFindMany },
    importRun: { findUnique: mockRunFindUnique, update: mockRunUpdate },
    importDiff: { deleteMany: mockDiffDeleteMany, count: mockDiffCount, createMany: mockDiffCreateMany },
    importLog: { create: mockImportLogCreate },
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}))

// Avoid real crawler/seeds behavior
vi.mock('../../packages/importer/src/crawlers/batsonCrawler', () => ({
  crawlBatson: vi.fn(async () => ({ headerSkipCount: 0, headerSkips: [] })),
}))
vi.mock('../../packages/importer/src/seeds/sources', () => ({
  fetchActiveSources: vi.fn(async () => []),
  upsertProductSource: vi.fn(async () => {}),
}))

// Capture product_db writer calls
const mockUpsert = vi.fn()
vi.mock('../services/productDbWriter.server', () => ({
  upsertNormalizedProduct: (...args: unknown[]) => mockUpsert(...args),
}))

describe('Save & Crawl product_db wiring (feature-flagged)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...OLD_ENV, PRODUCT_DB_ENABLED: '1' }
    // Minimal prisma responses to let the pipeline run
    mockRunFindUnique.mockResolvedValue({ id: 'run-1', summary: {} })
    mockRunUpdate.mockResolvedValue({ id: 'run-1' })
    mockDiffDeleteMany.mockResolvedValue({ count: 0 })
    mockDiffCount.mockResolvedValue(0)
    mockDiffCreateMany.mockResolvedValue({ count: 0 })
    mockImportLogCreate.mockResolvedValue({ id: 'log-1' })
    // $queryRawUnsafe used for checking Part table existence and selecting rows
    mockQueryRawUnsafe.mockResolvedValue([])
  })

  test('calls upsertNormalizedProduct for each staged row when enabled', async () => {
    // Provide two staged rows in current scope
    mockFindMany.mockResolvedValue([
      {
        externalId: 'SKU-1',
        title: 'Item 1',
        partType: 'Type A',
        description: 'Desc 1',
        images: [{ url: 'x' }],
        rawSpecs: { raw: 1 },
        normSpecs: { n: 1 },
        priceMsrp: 12.34,
        priceWh: 9.99,
        fetchedAt: new Date('2025-11-10T12:00:00Z'),
      },
      {
        externalId: 'SKU-2',
        title: 'Item 2',
        partType: 'Type B',
        description: null,
        images: null,
        rawSpecs: null,
        normSpecs: null,
        priceMsrp: null,
        priceWh: null,
        fetchedAt: new Date('2025-11-10T12:05:00Z'),
      },
    ])

    const mod = await import('../services/importer/runOptions.server')
    const { startImportFromOptions } = mod

    await startImportFromOptions({
      mode: 'discover',
      includeSeeds: true,
      manualUrls: [],
      skipSuccessful: false,
      notes: '',
      supplierId: 'batson',
      templateId: undefined,
      templateKey: undefined,
      variantTemplateId: undefined,
      scraperId: undefined,
      useSeriesParser: false,
    })

    // Writer called for each staged row
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    const first = mockUpsert.mock.calls[0][0]
    expect(first.sku).toBe('SKU-1')
    const second = mockUpsert.mock.calls[1][0]
    expect(second.sku).toBe('SKU-2')
  })
})
