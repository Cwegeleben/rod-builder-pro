import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

// Mock auth/guard to no-op
vi.mock('../lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => {}) }))

// Mock Prisma calls used by the publish endpoint
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockCount = vi.fn()
vi.mock('../db.server', () => ({
  prisma: {
    importRun: { findUnique: mockFindUnique, update: mockUpdate },
    importDiff: { count: mockCount },
  },
}))

// Mock publish implementation to avoid hitting Shopify
const mockPublish = vi.fn(async () => ({
  totals: { adds: 1, changes: 2 },
  totalsDetailed: { adds: 1, changes: 2, deletes: 0 },
  productIds: [111],
  shopDomain: 'test.myshopify.com',
}))
vi.mock('../services/importer/publishShopify.server', () => ({ publishRunToShopify: mockPublish }))

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
    mockFindUnique.mockResolvedValue({ id: 'run-1', summary: {}, supplierId: 'batson' })
    mockCount.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where?.diffType === 'conflict') return 0
      // approved diffs
      return 5
    })
    mockUpdate.mockResolvedValue({ id: 'run-1' })
  })

  test('publishes approved diffs and marks run published', async () => {
    const req = new Request('http://localhost/api/importer/runs/run-1/publish/shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    })
    const res = await runAction({ request: req, params: { runId: 'run-1' } })
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.runId).toBe('run-1')
    expect(mockPublish).toHaveBeenCalled()
    // Ensure status transitions attempted
    expect(mockUpdate).toHaveBeenCalled()
  })
})
