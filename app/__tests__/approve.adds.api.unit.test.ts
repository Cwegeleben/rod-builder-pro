import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

// Mock auth/guard to no-op
vi.mock('../lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => {}) }))

// Prisma mocks
const mockDiffCount = vi.fn()
const mockDiffUpdateMany = vi.fn()
vi.mock('../db.server', () => ({
  prisma: {
    importDiff: { count: mockDiffCount, updateMany: mockDiffUpdateMany },
  },
}))

async function runAction(url: string, body?: unknown) {
  const mod = await import('../routes/api.importer.runs.$runId.approve.adds')
  const action = mod.action as (args: ActionFunctionArgs) => Promise<Response>
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) init.body = JSON.stringify(body)
  const req = new Request(url, init)
  return action({ request: req, params: { runId: 'run-1' } } as unknown as ActionFunctionArgs)
}

describe('Approve Adds API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('approves unresolved adds and returns totals', async () => {
    mockDiffCount.mockImplementation(async (args: { where?: { diffType?: string; OR?: unknown } }) => {
      const { where } = args
      if (!where) return 0
      if (where.diffType === 'add' && !where.OR) return 5 // total adds
      if (where.diffType === 'add' && Array.isArray(where.OR)) return 3 // unresolved
      return 0
    })
    mockDiffUpdateMany.mockResolvedValue({ count: 3 })

    const res = await runAction('http://localhost/api/importer/runs/run-1/approve/adds')
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.updated).toBe(3)
    expect(jr.totals).toEqual({ totalAdds: 5, unresolvedAdds: 3 })
    // default mode should not set all=true
    expect(jr.all).toBeFalsy()
  })

  test('all=1 re-approves non-approved adds', async () => {
    mockDiffCount.mockResolvedValue(5)
    mockDiffUpdateMany.mockResolvedValue({ count: 5 })

    const res = await runAction('http://localhost/api/importer/runs/run-1/approve/adds?all=1')
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.updated).toBe(5)
    expect(jr.all).toBe(true)
    // ensure where clause uses resolution not approve
    expect(mockDiffUpdateMany).toHaveBeenCalled()
    const callArg = mockDiffUpdateMany.mock.calls[0][0]
    expect(callArg.where.resolution.not).toBe('approve')
  })
})
