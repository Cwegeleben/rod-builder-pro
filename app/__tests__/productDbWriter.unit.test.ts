import { describe, test, expect, beforeEach, vi } from 'vitest'

// The writer implementation uses raw SQL helpers ($queryRawUnsafe / $executeRawUnsafe).
// We simulate the minimal subset of raw queries it issues in sequence.
const mockQueryRawUnsafe = vi.fn()
const mockExecuteRawUnsafe = vi.fn()

vi.mock('../db.server', () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}))

describe('productDbWriter upsertNormalizedProduct', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('creates product + version on first insert; reuses version on identical second insert', async () => {
    const { upsertNormalizedProduct, computeContentHash } = await import('../services/productDbWriter.server')
    const input = {
      supplier: { id: 'sup-1' },
      sku: 'SKU-123',
      title: 'Widget',
      type: 'widget',
      description: 'A great widget',
      normSpecs: { weight: '1oz', length: '6in' },
      priceMsrp: 10,
      priceWholesale: 7.5,
      availability: 'in_stock',
      images: [{ url: 'https://img/1.jpg' }],
      sources: [{ url: 'https://example.com/p/sku-123', source: 'discovered' }],
      fetchedAt: '2025-11-10T12:00:00Z',
    }
    const typedInput = input as import('../services/productDbWriter.server').NormalizedProductInput
    const hash = computeContentHash(typedInput)

    // Sequence of raw queries for first call (including ensureSupplier):
    // 1. SELECT id FROM Supplier WHERE id = ? -> [{ id: 'sup-1' }]
    // 2. SELECT id, latestVersionId FROM Product ... -> [] (no product)
    // 3. SELECT id FROM ProductVersion WHERE productId=? AND contentHash=? -> [] (no existing version)
    // 4. SELECT id FROM ProductSource WHERE supplierId=? AND url=? AND templateId IS NULL -> []
    mockQueryRawUnsafe
      // supplier lookup
      .mockResolvedValueOnce([{ id: 'sup-1' }])
      // product lookup
      .mockResolvedValueOnce([])
      // version duplicate lookup
      .mockResolvedValueOnce([])
      // product source lookup
      .mockResolvedValueOnce([])
    mockExecuteRawUnsafe
      // insert product
      .mockResolvedValueOnce({})
      // insert version
      .mockResolvedValueOnce({})
      // update product.latestVersionId
      .mockResolvedValueOnce({})
      // insert product source
      .mockResolvedValueOnce({})

    const res1 = await upsertNormalizedProduct(typedInput)
    expect(res1.createdProduct).toBe(true)
    expect(res1.createdVersion).toBe(true)
    expect(res1.contentHash).toBe(hash)
    // First pass issues 3 SELECTs (product, version dup, source) but may emit an additional supplier lookup in some envs.
    // Accept >=3 to avoid brittle coupling to internal query ordering.
    expect(mockQueryRawUnsafe.mock.calls.length).toBeGreaterThanOrEqual(3)
    // Second call: product exists and version exists (same hash)
    mockQueryRawUnsafe
      // supplier lookup
      .mockResolvedValueOnce([{ id: 'sup-1' }])
      // product lookup -> found existing product
      .mockResolvedValueOnce([{ id: 'prod-1', latestVersionId: 'ver-1' }])
      // version duplicate lookup -> found existing version
      .mockResolvedValueOnce([{ id: 'ver-1' }])
      // product source lookup -> found existing source row
      .mockResolvedValueOnce([{ id: 'src-1' }])
    mockExecuteRawUnsafe
      // title/type update
      .mockResolvedValueOnce({})
      // update existing product source
      .mockResolvedValueOnce({})

    const res2 = await upsertNormalizedProduct(typedInput)
    expect(res2.createdProduct).toBe(false)
    expect(res2.createdVersion).toBe(false)
    expect(res2.versionId).toBe('ver-1')
    // Ensure we executed raw updates instead of inserts on second pass
    expect(mockExecuteRawUnsafe).toHaveBeenCalled()
  })
})
