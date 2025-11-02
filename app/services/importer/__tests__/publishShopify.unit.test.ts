import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../../db.server'
import { publishRunToShopify } from '../publishShopify.server'

describe('publishRunToShopify (dry-run)', () => {
  const runId = `test-run-${Date.now()}`

  beforeAll(async () => {
    // Seed a few approved diffs with mixed diffTypes
    await prisma.importDiff.createMany({
      data: [
        { importRunId: runId, externalId: 'A1', diffType: 'add', resolution: 'approve' },
        { importRunId: runId, externalId: 'A2', diffType: 'add', resolution: 'approve' },
        { importRunId: runId, externalId: 'C1', diffType: 'change', resolution: 'approve' },
        { importRunId: runId, externalId: 'D1', diffType: 'delete', resolution: 'approve' },
        // This would normally be preconditioned out, but ensure it doesn't count
        { importRunId: runId, externalId: 'X1', diffType: 'conflict', resolution: 'approve' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
  })

  it('computes created/updated totals from approved diffs (dryRun)', async () => {
    const { totals, productIds } = await publishRunToShopify({ runId, dryRun: true })
    expect(totals).toEqual({ created: 2, updated: 2, skipped: 0, failed: 0 })
    expect(productIds).toEqual([])
  })

  it('returns same totals in non-dry path (stubbed)', async () => {
    const { totals } = await publishRunToShopify({ runId, dryRun: false })
    expect(totals).toEqual({ created: 2, updated: 2, skipped: 0, failed: 0 })
  })
})
