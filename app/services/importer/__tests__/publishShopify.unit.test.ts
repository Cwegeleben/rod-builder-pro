import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../../db.server'
import { publishRunToShopify } from '../publishShopify.server'

describe('publishRunToShopify (dry-run)', () => {
  const runId = `test-run-${Date.now()}`
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('computes created/updated totals from approved diffs (dryRun)', async () => {
    // Mock prisma calls to avoid real DB access
    type FindManyReturn = Awaited<ReturnType<typeof prisma.importDiff.findMany>>
    const diffs = [
      { id: '1', diffType: 'add' },
      { id: '2', diffType: 'add' },
      { id: '3', diffType: 'change' },
      { id: '4', diffType: 'delete' },
      { id: '5', diffType: 'conflict' },
    ] as Array<{ id: string; diffType: string }>
    vi.spyOn(prisma.importDiff, 'findMany').mockResolvedValue(diffs as unknown as FindManyReturn)
    vi.spyOn(prisma.importRun, 'findUnique').mockResolvedValue(
      null as Awaited<ReturnType<typeof prisma.importRun.findUnique>>,
    )
    vi.spyOn(prisma.importRun, 'update').mockResolvedValue({} as Awaited<ReturnType<typeof prisma.importRun.update>>)

    const { totals, productIds } = await publishRunToShopify({ runId, dryRun: true })
    expect(totals).toEqual({ created: 2, updated: 2, skipped: 0, failed: 0 })
    expect(productIds).toEqual([])
  })

  it('returns same totals in non-dry path (stubbed)', async () => {
    type FindManyReturn = Awaited<ReturnType<typeof prisma.importDiff.findMany>>
    const diffs = [
      { id: '1', diffType: 'add' },
      { id: '2', diffType: 'add' },
      { id: '3', diffType: 'change' },
      { id: '4', diffType: 'delete' },
    ] as Array<{ id: string; diffType: string }>
    vi.spyOn(prisma.importDiff, 'findMany').mockResolvedValue(diffs as unknown as FindManyReturn)
    vi.spyOn(prisma.importRun, 'findUnique').mockResolvedValue(
      null as Awaited<ReturnType<typeof prisma.importRun.findUnique>>,
    )
    vi.spyOn(prisma.importRun, 'update').mockResolvedValue({} as Awaited<ReturnType<typeof prisma.importRun.update>>)
    // Ensure no SHOP variable so we take the no-op publish path
    delete process.env.SHOP
    delete process.env.SHOP_CUSTOM_DOMAIN

    const { totals } = await publishRunToShopify({ runId, dryRun: false })
    expect(totals).toEqual({ created: 2, updated: 2, skipped: 0, failed: 0 })
  })
})
