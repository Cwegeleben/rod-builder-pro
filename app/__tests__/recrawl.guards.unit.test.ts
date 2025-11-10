import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'
import { action as recrawlAction } from '../routes/api.importer.recrawl'

vi.mock('../lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => true) }))

let preparingRunId: string | null = null
let publishInProgress = false
let recentRecrawl = false

vi.mock('../db.server', () => {
  return {
    prisma: {
      importTemplate: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          preparingRunId,
        })),
      },
      importLog: {
        findFirst: vi.fn(
          async ({ where }: { where: { templateId?: string; type?: string; at?: { gte?: string } } }) => {
            if (where?.type === 'publish:progress' && publishInProgress) return { id: 'pub1' }
            if (where?.type === 'recrawl:start' && recentRecrawl) return { id: 'rc1' }
            return null
          },
        ),
        create: vi.fn(async () => ({})),
      },
      importRun: {
        findUnique: vi.fn(async () => ({ id: 'run-x', status: 'staged' })),
        update: vi.fn(async () => ({})),
      },
      importDiff: {
        updateMany: vi.fn(async () => ({ count: 3 })),
        count: vi.fn(async () => 3),
      },
    },
  }
})

vi.mock('../server/importer/sites/targets', () => ({ getTargetById: (id: string) => ({ id, siteId: id }) }))
vi.mock('../routes/api.importer.prepare', () => ({
  action: async () => new Response(JSON.stringify({ ok: true, runId: 'run-x' }), { status: 200 }),
}))
vi.mock('../routes/api.importer.runs.$runId.publish.shopify', () => ({
  action: async () =>
    new Response(JSON.stringify({ ok: true, totals: { created: 1, updated: 0, skipped: 0, failed: 0 } }), {
      status: 200,
    }),
}))

function req(body: unknown): Request {
  return new Request('http://localhost/api/importer/recrawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('recrawl guards with codes', () => {
  beforeEach(() => {
    preparingRunId = null
    publishInProgress = false
    recentRecrawl = false
  })
  it('returns blocked_prepare code', async () => {
    preparingRunId = 'run-prep'
    const r = await recrawlAction({ request: req({ templateId: 'tpl-1' }) } as unknown as ActionFunctionArgs)
    expect(r.status).toBe(409)
    const j = (await r.json()) as { error: string; code: string; hint?: string }
    expect(j.code).toBe('blocked_prepare')
    expect(j.hint).toMatch(/prepare/i)
  })
  it('returns blocked_publish code', async () => {
    publishInProgress = true
    const r = await recrawlAction({ request: req({ templateId: 'tpl-1' }) } as unknown as ActionFunctionArgs)
    expect(r.status).toBe(409)
    const j = (await r.json()) as { error: string; code: string }
    expect(j.code).toBe('blocked_publish')
  })
  it('returns rate_limit code', async () => {
    recentRecrawl = true
    const r = await recrawlAction({ request: req({ templateId: 'tpl-1' }) } as unknown as ActionFunctionArgs)
    expect(r.status).toBe(429)
    const j = (await r.json()) as { error: string; code: string; retryAfterSeconds?: number }
    expect(j.code).toBe('rate_limit')
    expect(j.retryAfterSeconds).toBe(120)
  })
  it('returns recrawl_done code on success', async () => {
    const r = await recrawlAction({
      request: req({ templateId: 'tpl-1', approveAdds: true, publish: true }),
    } as unknown as ActionFunctionArgs)
    expect(r.status).toBe(200)
    const j = (await (r.json() as unknown)) as { ok?: boolean; code?: string; goal?: number }
    expect(j.code).toBe('recrawl_done')
    expect(j.goal).toBe(3)
  })
})
