import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

vi.mock('../lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => {}) }))

const mockUpdateMany = vi.fn()
vi.mock('../db.server', () => ({ prisma: { importDiff: { updateMany: mockUpdateMany } } }))

async function runAction(ids: string[]) {
  const mod = await import('../routes/api.importer.runs.$runId.approve')
  const action = mod.action as (args: ActionFunctionArgs) => Promise<Response>
  const req = new Request('http://localhost/api/importer/runs/run-xyz/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  return action({ request: req, params: { runId: 'run-xyz' } } as unknown as ActionFunctionArgs)
}

describe('Approve Selected API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('no ids returns zero approved', async () => {
    const res = await runAction([])
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.approvedCount).toBe(0)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  test('approves listed ids', async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 })
    const res = await runAction(['d1', 'd2'])
    expect(res.ok).toBe(true)
    const jr = await res.json()
    expect(jr.ok).toBe(true)
    expect(jr.approvedCount).toBe(2)
    const arg = mockUpdateMany.mock.calls[0][0]
    expect(arg.where.importRunId).toBe('run-xyz')
    expect(arg.where.id.in).toEqual(['d1', 'd2'])
  })
})
