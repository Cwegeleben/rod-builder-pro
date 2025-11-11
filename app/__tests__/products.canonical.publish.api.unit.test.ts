import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

// Stub auth
vi.mock('../shopify.server', () => ({
  authenticate: { admin: vi.fn(async () => ({ session: { shop: 'test.myshopify.com' } })) },
}))

// Mock Prisma for dry-run fallback query
const mockQuery = vi.fn()
vi.mock('../db.server', () => ({ prisma: { $queryRawUnsafe: mockQuery } }))

// Mock real canonical publisher
const mockPublishCanonical = vi.fn()
vi.mock('../services/publishCanonical.server', () => ({ publishCanonicalProduct: mockPublishCanonical }))

async function runAction(args: Partial<ActionFunctionArgs>) {
  const mod = await import('../routes/api.products.$id.publish')
  const action = mod.action as (args: ActionFunctionArgs) => Promise<Response>
  return action(args as ActionFunctionArgs)
}

describe('Canonical product publish API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.PRODUCT_DB_ENABLED = '1'
  })

  test('dry-run by default returns heuristic counts', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'p1', sku: 'SKU1', latestVersionId: 'v1', status: 'DRAFT' }])
    const req = new Request('http://localhost/api/products/p1/publish', { method: 'POST' })
    const res = await runAction({ request: req, params: { id: 'p1' } })
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.created).toBe(1)
    expect(jr.updated).toBe(0)
    expect(mockPublishCanonical).not.toHaveBeenCalled()
  })

  test('real publish (dryRun=false) calls canonical publisher and returns totals', async () => {
    mockPublishCanonical.mockResolvedValueOnce({
      ok: true,
      created: 1,
      updated: 2,
      failed: 0,
      shopDomain: 'test.myshopify.com',
    })
    const req = new Request('http://localhost/api/products/p2/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    })
    const res = await runAction({ request: req, params: { id: 'p2' } })
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.created).toBe(1)
    expect(jr.updated).toBe(2)
    expect(mockPublishCanonical).toHaveBeenCalledWith({ productId: 'p2', dryRun: false })
  })
})
