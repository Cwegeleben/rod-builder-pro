import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../app/services/shopifyAdmin.server', () => ({
  getShopAccessToken: vi.fn(async () => 'tok'),
}))

vi.mock('../../packages/importer/src/sync/shopify', () => ({
  upsertShopifyForRun: vi.fn(async () => [
    { externalId: 'A1', productId: 111, handle: 'rbp-batson-a1', action: 'created' as const },
    { externalId: 'B2', productId: 222, handle: 'rbp-batson-b2', action: 'updated' as const },
  ]),
}))

vi.mock('../../app/db.server', () => ({
  prisma: {
    importRun: { findUnique: vi.fn(async () => ({ id: 'run-1', supplierId: 'batson' })) },
  },
}))

import { applyImportRunToShop } from '../../app/services/importer/applyRun.server'
import { upsertShopifyForRun } from '../../packages/importer/src/sync/shopify'

describe('applyImportRunToShop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('threads approvedOnly and returns results', async () => {
    const res = await applyImportRunToShop({ runId: 'run-1', shopDomain: 'example.myshopify.com', approvedOnly: true })
    expect(res.ok).toBe(true)
    expect(res.shopDomain).toBe('example.myshopify.com')
    expect(res.results?.length).toBe(2)
    expect(vi.mocked(upsertShopifyForRun)).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        shopName: 'example.myshopify.com',
        approvedOnly: true,
      }),
    )
  })
})
