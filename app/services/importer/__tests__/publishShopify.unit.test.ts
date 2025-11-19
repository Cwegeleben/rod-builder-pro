import { describe, it, expect, vi, beforeEach } from 'vitest'

// Provide a lightweight Prisma mock so no real engine loads during unit tests
vi.mock('../../../db.server', () => {
  const prisma = {
    runMappingSnapshot: { findUnique: vi.fn(async () => null) },
    importDiff: { findMany: vi.fn(async () => []) },
    importRun: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    importLog: { create: vi.fn(async () => ({})) },
    $queryRawUnsafe: vi.fn(async () => [{ c: 0 }]),
    session: { findFirst: vi.fn(async () => null) },
  }
  return { prisma }
})

import { prisma } from '../../../db.server'
import { publishRunToShopify } from '../publishShopify.server'

describe('publishRunToShopify (dry-run)', () => {
  const runId = `test-run-${Date.now()}`
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes created/updated totals from approved diffs (dryRun)', async () => {
    // Mock prisma calls to avoid real DB access
    const diffs = [
      { id: '1', diffType: 'add' },
      { id: '2', diffType: 'add' },
      { id: '3', diffType: 'change' },
      { id: '4', diffType: 'delete' },
      { id: '5', diffType: 'conflict' },
    ] as Array<{ id: string; diffType: string }>
    const mocked = prisma as unknown as {
      importDiff: { findMany: ReturnType<typeof vi.fn> }
      importRun: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
    }
    mocked.importDiff.findMany.mockResolvedValueOnce(diffs as unknown as never)
    mocked.importRun.findUnique.mockResolvedValueOnce(null as never)
    mocked.importRun.update.mockResolvedValueOnce({} as never)

    const { totals, productIds } = await publishRunToShopify({ runId, dryRun: true })
    expect(totals).toEqual({ created: 2, updated: 2, skipped: 0, failed: 0 })
    expect(productIds).toEqual([])
  })

  it('returns same totals in non-dry path (stubbed)', async () => {
    const diffs = [
      { id: '1', diffType: 'add' },
      { id: '2', diffType: 'add' },
      { id: '3', diffType: 'change' },
      { id: '4', diffType: 'delete' },
    ] as Array<{ id: string; diffType: string }>
    const mocked = prisma as unknown as {
      importDiff: { findMany: ReturnType<typeof vi.fn> }
      importRun: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
    }
    mocked.importDiff.findMany.mockResolvedValueOnce(diffs as unknown as never)
    mocked.importRun.findUnique.mockResolvedValueOnce(null as never)
    mocked.importRun.update.mockResolvedValueOnce({} as never)
    // Ensure no SHOP variable so we take the no-op publish path
    delete process.env.SHOP
    delete process.env.SHOP_CUSTOM_DOMAIN

    const { totals } = await publishRunToShopify({ runId, dryRun: false })
    expect(totals).toEqual({ created: 2, updated: 2, skipped: 0, failed: 0 })
  })
})
