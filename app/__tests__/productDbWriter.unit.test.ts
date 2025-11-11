import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock Prisma client used by the writer service
const mockSupplierFindUnique = vi.fn()
const mockSupplierCreate = vi.fn()
const mockSupplierUpsert = vi.fn()

const mockProductFindUnique = vi.fn()
const mockProductCreate = vi.fn()
const mockProductUpdate = vi.fn()

const mockProductVersionFindUnique = vi.fn()
const mockProductVersionCreate = vi.fn()

const mockProductSourceUpsert = vi.fn()

vi.mock('../db.server', () => ({
  prisma: {
    supplier: {
      findUnique: mockSupplierFindUnique,
      create: mockSupplierCreate,
      upsert: mockSupplierUpsert,
    },
    product: {
      findUnique: mockProductFindUnique,
      create: mockProductCreate,
      update: mockProductUpdate,
    },
    productVersion: {
      findUnique: mockProductVersionFindUnique,
      create: mockProductVersionCreate,
    },
    productSource: {
      upsert: mockProductSourceUpsert,
    },
  },
}))

describe('productDbWriter upsertNormalizedProduct', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('creates product + version on first insert and skips version on identical second insert', async () => {
    const mod = await import('../services/productDbWriter.server')
    const { upsertNormalizedProduct, computeContentHash } = mod

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

    // Cast to the writer's input type to satisfy typing without loosening to any
    const hash = computeContentHash(input as import('../services/productDbWriter.server').NormalizedProductInput)

    // Supplier exists
    mockSupplierFindUnique.mockResolvedValue({ id: 'sup-1' })

    // First call: no product exists, create it
    mockProductFindUnique.mockResolvedValueOnce(null)
    mockProductCreate.mockResolvedValue({ id: 'prod-1', latestVersionId: null })
    mockProductVersionCreate.mockResolvedValue({ id: 'ver-1', contentHash: hash })

    const res1 = await upsertNormalizedProduct(
      input as import('../services/productDbWriter.server').NormalizedProductInput,
    )
    expect(res1.supplierId).toBe('sup-1')
    expect(res1.productId).toBe('prod-1')
    expect(res1.versionId).toBe('ver-1')
    expect(res1.createdProduct).toBe(true)
    expect(res1.createdVersion).toBe(true)
    expect(res1.contentHash).toBe(hash)

    // Ensure we linked latestVersionId and upserted source once
    expect(mockProductUpdate).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { latestVersionId: 'ver-1' } })
    expect(mockProductSourceUpsert).toHaveBeenCalledTimes(1)

    // Second call: product exists with same latest version hash
    mockProductFindUnique.mockResolvedValueOnce({ id: 'prod-1', latestVersionId: 'ver-1' })
    mockProductVersionFindUnique.mockResolvedValueOnce({ id: 'ver-1', contentHash: hash })

    const res2 = await upsertNormalizedProduct(
      input as import('../services/productDbWriter.server').NormalizedProductInput,
    )
    expect(res2.createdProduct).toBe(false)
    expect(res2.createdVersion).toBe(false)
    expect(res2.versionId).toBe('ver-1')
    // Should refresh source link
    expect(mockProductSourceUpsert).toHaveBeenCalledTimes(2)
  })
})
