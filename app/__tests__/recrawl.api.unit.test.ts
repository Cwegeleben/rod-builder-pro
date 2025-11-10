import { describe, it, expect, vi } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'
import { action as recrawlAction } from '../routes/api.importer.recrawl'

// Mock access control to bypass HQ requirement
vi.mock('../lib/access.server', () => ({
  requireHqShopOr404: vi.fn(async () => true),
}))

// Helper to build a Request with JSON body
function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Shared mutable fakes
let preparingRunId: string | null = null
let publishInProgress = false

// Provide minimal prisma mock
vi.mock('../db.server', () => {
  const logs: Array<{ type: string; payload: unknown }> = []
  return {
    prisma: {
      importTemplate: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          importConfig: { settings: { target: 'fake-target' } },
          preparingRunId,
        })),
      },
      importLog: {
        findFirst: vi.fn(async () => (publishInProgress ? { id: 'log1' } : null)),
        create: vi.fn(async ({ data }: { data: { type: string; payload: unknown } }) => {
          logs.push({ type: data.type, payload: data.payload })
          return data
        }),
      },
      importRun: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, status: 'staged' })),
        update: vi.fn(async () => ({})),
      },
      importDiff: {
        updateMany: vi.fn(async () => ({ count: 3 })),
        count: vi.fn(async () => {
          // After approveAdds we pretend there are 3 approved adds
          return 3
        }),
      },
    },
  }
})

// Mock target resolver
vi.mock('../server/importer/sites/targets', () => ({
  getTargetById: (id: string) => ({ id, siteId: 'supplier-123', url: 'https://example.com' }),
}))

// Mock prepare action used internally by recrawl endpoint
vi.mock('../routes/api.importer.prepare', () => ({
  action: async () => new Response(JSON.stringify({ ok: true, runId: 'run-abc' }), { status: 200 }),
}))

// Mock publish action for real publish path
vi.mock('../routes/api.importer.runs.$runId.publish.shopify', () => ({
  action: async () => {
    // Simulate totals; created 2, updated 1
    return new Response(
      JSON.stringify({ ok: true, runId: 'run-abc', totals: { created: 2, updated: 1, skipped: 0, failed: 0 } }),
      { status: 200 },
    )
  },
}))

describe('recrawl action', () => {
  type ErrorResponse = { error: string }
  type PublishTotals = { created: number; updated: number; skipped: number; failed: number }
  type OkResponse = {
    ok: boolean
    runId: string
    queued?: boolean
    goal?: number
    publish?: { totals?: PublishTotals }
  }

  it('blocks when prepare is active', async () => {
    preparingRunId = 'run-prep'
    publishInProgress = false
    const req = jsonRequest('http://localhost/api/importer/recrawl', { templateId: 'tpl-1', approveAdds: true })
    const res = await recrawlAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(409)
    const j = (await res.json()) as ErrorResponse
    expect(j.error).toMatch(/prepare run is already active/i)
    preparingRunId = null
  })

  it('blocks when publish is in progress', async () => {
    publishInProgress = true
    const req = jsonRequest('http://localhost/api/importer/recrawl', { templateId: 'tpl-2', approveAdds: true })
    const res = await recrawlAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(409)
    const j = (await res.json()) as ErrorResponse
    expect(j.error).toMatch(/publish appears to be in progress/i)
    publishInProgress = false
  })

  it('runs full recrawl + publish and returns goal & totals', async () => {
    const req = jsonRequest('http://localhost/api/importer/recrawl', {
      templateId: 'tpl-3',
      approveAdds: true,
      publish: true,
      dryRun: false,
    })
    const res = await recrawlAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const j = (await res.json()) as OkResponse
    expect(j.ok).toBe(true)
    expect(j.runId).toBe('run-abc')
    expect(j.goal).toBe(3)
    // publish totals nested in publish
    expect(j.publish?.totals?.created).toBe(2)
    expect(j.publish?.totals?.updated).toBe(1)
  })
})
