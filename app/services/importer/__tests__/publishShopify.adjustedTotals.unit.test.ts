import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PublishResult } from '../../importer/publishShopify.server'

// Mock Prisma surface used by publishRunToShopify
const mockFindUniqueRun = vi.fn()
const mockUpdateRun = vi.fn()
const mockFindManyDiffs = vi.fn()
const mockFindUniqueSnap = vi.fn()
const mockCreateLog = vi.fn()
const mockSessionFindFirst = vi.fn()
const mockQueryRawUnsafe = vi.fn()

vi.mock('../../../db.server', () => ({
  prisma: {
    importRun: { findUnique: mockFindUniqueRun, update: mockUpdateRun },
    importDiff: { findMany: mockFindManyDiffs },
    runMappingSnapshot: { findUnique: mockFindUniqueSnap },
    importLog: { create: mockCreateLog },
    session: { findFirst: mockSessionFindFirst },
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}))

// Mock Shopify admin token
vi.mock('../../shopifyAdmin.server', () => ({ getShopAccessToken: vi.fn(async () => 'shpca_test_token') }))

// Mock the importer upsert to avoid hitting Shopify and to control created/updated mix
const mockUpsert = vi.fn()
type UpsertResult = { externalId: string; productId: number; handle: string; action: 'created' | 'updated' }
vi.mock('../../../../packages/importer/src/sync/shopify', () => ({
  upsertShopifyForRun: (runId: string, cfg: Record<string, unknown>): Promise<UpsertResult[]> => mockUpsert(runId, cfg),
}))

describe('publishRunToShopify adjusted totals (hash-unchanged deductions)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFindUniqueRun.mockResolvedValue({ id: 'run-abc', summary: {}, supplierId: 'batson' })
    mockFindUniqueSnap.mockResolvedValue({ templateId: 'tpl-1' })
    mockSessionFindFirst.mockResolvedValue({ shop: 'stub.myshopify.com' })
    // 5 approved diffs: 2 adds, 3 changes
    mockFindManyDiffs.mockResolvedValue([
      { id: 'd1', diffType: 'add', externalId: 'A1' },
      { id: 'd2', diffType: 'add', externalId: 'A2' },
      { id: 'd3', diffType: 'change', externalId: 'C1' },
      { id: 'd4', diffType: 'change', externalId: 'C2' },
      { id: 'd5', diffType: 'change', externalId: 'C3' },
    ])
    mockUpdateRun.mockResolvedValue({ id: 'run-abc' })
    mockCreateLog.mockResolvedValue({ id: 'log-1' })
    // Fail/unchanged counts via raw SQL detectors
    mockQueryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes('validation LIKE') && sql.includes('"error"')) return [{ c: 0 }]
      if (sql.includes('skipReason":"hash-unchanged-title-updated"')) return [{ c: 2 }]
      if (sql.includes('skipReason":"hash-unchanged-specs-backfilled"')) return [{ c: 1 }]
      if (sql.includes('skipReason":"unchanged-and-active"')) return [{ c: 1 }]
      if (sql.includes('skipReason":"unchanged-specs-backfilled"')) return [{ c: 1 }]
      return [{ c: 0 }]
    })
    // upsert results: 2 created, 3 updated
    mockUpsert.mockResolvedValue([
      { externalId: 'A1', productId: 101, handle: 'rbp-batson-a1', action: 'created' },
      { externalId: 'A2', productId: 102, handle: 'rbp-batson-a2', action: 'created' },
      { externalId: 'C1', productId: 201, handle: 'rbp-batson-c1', action: 'updated' },
      { externalId: 'C2', productId: 202, handle: 'rbp-batson-c2', action: 'updated' },
      { externalId: 'C3', productId: 203, handle: 'rbp-batson-c3', action: 'updated' },
    ])
  })

  it('subtracts hash-unchanged title/spec backfills from updated total and exposes detailed buckets', async () => {
    const mod = await import('../publishShopify.server')
    const res = (await mod.publishRunToShopify({
      runId: 'run-abc',
      dryRun: false,
      shopDomain: 'stub.myshopify.com',
    })) as PublishResult

    expect(res.totals.created).toBe(2)
    // raw updated was 3, minus (title=2 + specs=1) => 0
    expect(res.totals.updated).toBe(0)
    // skipped should be 0 since target=5 and rawUpdated=3, created=2, failed=0
    expect(res.totals.skipped).toBe(0)
    expect(res.totals.failed).toBe(0)
    // Detailed buckets
    expect(res.totalsDetailed?.hash_unchanged_title_updated).toBe(2)
    expect(res.totalsDetailed?.hash_unchanged_specs_backfilled).toBe(1)
    expect(res.totalsDetailed?.unchanged_active).toBe(1)
    expect(res.totalsDetailed?.unchanged_specs_backfilled).toBe(1)
  })
})
