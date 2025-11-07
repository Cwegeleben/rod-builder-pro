import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

// Mock auth/guard to no-op
vi.mock('../lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => {}) }))

// Mock Prisma calls used by the publish endpoint and the publisher implementation
const mockRunFindUnique = vi.fn()
const mockRunUpdate = vi.fn()
const mockDiffCount = vi.fn()
const mockDiffFindMany = vi.fn()
const mockRunSnapFindUnique = vi.fn()
const mockImportLogCreate = vi.fn()
const mockSessionFindFirst = vi.fn()
const mockQueryRawUnsafe = vi.fn()
vi.mock('../db.server', () => ({
  prisma: {
    importRun: { findUnique: mockRunFindUnique, update: mockRunUpdate },
    importDiff: { count: mockDiffCount, findMany: mockDiffFindMany },
    runMappingSnapshot: { findUnique: mockRunSnapFindUnique },
    importLog: { create: mockImportLogCreate },
    session: { findFirst: mockSessionFindFirst },
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}))

// Do not mock publishShopify.server — we let it run against the mocked Prisma above

// authenticate.admin is used only to fetch shop name; stub to avoid network
vi.mock('../shopify.server', () => ({
  authenticate: { admin: vi.fn(async () => ({ session: { shop: 'stub.myshopify.com' } })) },
}))

async function runAction(args: Partial<ActionFunctionArgs>) {
  const mod = await import('../routes/api.importer.runs.$runId.publish.shopify')
  const action = mod.action as (args: ActionFunctionArgs) => Promise<Response>
  return action(args as ActionFunctionArgs)
}

describe('Publish Shopify API (happy path)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRunFindUnique.mockResolvedValue({ id: 'run-1', summary: {}, supplierId: 'batson' })
    mockDiffCount.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
      const where = args?.where || {}
      if (where?.diffType === 'conflict') return 0
      // approved diffs
      return 5
    })
    mockRunUpdate.mockResolvedValue({ id: 'run-1' })
    // Provide a mix of adds and changes for publish totals
    mockDiffFindMany.mockResolvedValue([
      { id: 'd1', diffType: 'add' },
      { id: 'd2', diffType: 'add' },
      { id: 'd3', diffType: 'change' },
      { id: 'd4', diffType: 'change' },
      { id: 'd5', diffType: 'change' },
    ])
    mockRunSnapFindUnique.mockResolvedValue({ templateId: 'tpl-1' })
    mockImportLogCreate.mockResolvedValue({ id: 'log-1' })
    mockSessionFindFirst.mockResolvedValue({ shop: 'stub.myshopify.com' })
    mockQueryRawUnsafe.mockResolvedValue([{ c: 0 }])
  })

  test('publishes approved diffs and marks run published', async () => {
    const req = new Request('http://localhost/api/importer/runs/run-1/publish/shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    })
    const res = await runAction({ request: req, params: { runId: 'run-1' } })
    if (!res.ok) {
      const err = await res.json().catch(async () => ({ text: await res.text() }))
      console.error('Publish API response', res.status, err)
    }
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.runId).toBe('run-1')
    // Ensure status transitions attempted
    expect(mockRunUpdate).toHaveBeenCalled()
  })
})
