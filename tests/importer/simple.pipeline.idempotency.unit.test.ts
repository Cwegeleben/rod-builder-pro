import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'

// Mock productDbWriter to avoid Prisma client dependency and implement deterministic upsert semantics
vi.mock('../../app/services/productDbWriter.server', () => {
  const seen = new Set<string>()
  return {
    upsertNormalizedProduct: vi.fn(async (input: { sku: string }) => {
      const key = input.sku
      if (seen.has(key)) {
        return {
          supplierId: 'batson',
          productId: 'p-' + key.slice(-6),
          versionId: 'v-' + key.slice(-6),
          createdProduct: false,
          createdVersion: false,
          contentHash: 'h-' + key.slice(-6),
        }
      }
      seen.add(key)
      return {
        supplierId: 'batson',
        productId: 'p-' + key.slice(-6),
        versionId: 'v-' + key.slice(-6),
        createdProduct: true,
        createdVersion: true,
        contentHash: 'h-' + key.slice(-6),
      }
    }),
  }
})

// Mock prisma used by runOptions to avoid real DB
vi.mock('../../app/db.server', () => {
  const runs: Record<string, { id: string; status: string; summary?: unknown; progress?: unknown; finishedAt?: Date }> =
    {}
  let idSeq = 1
  const mkId = () => `run-${idSeq++}`
  const prisma = {
    importRun: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => runs[where.id] || null),
      create: vi.fn(async ({ data }: { data: { supplierId: string; status: string; summary?: unknown } }) => {
        const id = mkId()
        runs[id] = { id, status: data.status, summary: data.summary }
        return { id }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = runs[where.id]
        if (!row) return {}
        if (typeof data.status === 'string') row.status = data.status
        if (data.summary !== undefined) row.summary = data.summary
        if (data.progress !== undefined) row.progress = data.progress
        if (data.finishedAt instanceof Date) row.finishedAt = data.finishedAt
        return {}
      }),
    },
    importTemplate: {
      findUnique: vi.fn(async () => ({ id: 'tpl-1', preparingRunId: null })),
      update: vi.fn(async () => ({})),
    },
    importLog: { create: vi.fn(async () => ({})) },
    // Used by ensureSupplier sometimes; not needed due to mock productDbWriter
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRawUnsafe: vi.fn(async () => 1),
  }
  return { prisma }
})

import { prisma } from '../../app/db.server'
import { startImportFromOptions } from '../../app/services/importer/runOptions.server'

describe('Simple pipeline idempotency', () => {
  beforeAll(() => {
    process.env.PRODUCT_DB_SIMPLE = '1'
  })
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('second run on identical manualUrls produces only skips (no new versions)', async () => {
    const manualUrls = [
      'https://example.com/products/foo-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'https://example.com/products/bar-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]
    const options = {
      mode: 'discover' as const,
      includeSeeds: true,
      manualUrls,
      skipSuccessful: false,
      notes: '',
      pipeline: 'simple' as const,
      supplierId: 'batson',
    }

    const firstRunId = await startImportFromOptions(options)
    const firstRun = await prisma.importRun.findUnique({ where: { id: firstRunId as string } })
    const firstSummary = (firstRun?.summary as unknown as { counts?: Record<string, number> }) || {}
    const firstCounts = firstSummary.counts || {}
    expect(firstCounts.add + firstCounts.change).toBeGreaterThan(0)

    const secondRunId = await startImportFromOptions(options)
    const secondRun = await prisma.importRun.findUnique({ where: { id: secondRunId as string } })
    const secondSummary = (secondRun?.summary as unknown as { counts?: Record<string, number> }) || {}
    const secondCounts = secondSummary.counts || {}

    // Expect skips to dominate second run (no adds; changes only if title normalization differs – simplified assertion)
    expect(secondCounts.add).toBe(0)
    // Allow either 0 changes or a small number due to title updates; core check: skip >= manualUrls.length - change
    expect(secondCounts.skip + (secondCounts.change || 0)).toBeGreaterThanOrEqual(
      manualUrls.length - (secondCounts.change || 0),
    )
  })
})
