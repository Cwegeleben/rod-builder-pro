import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'
import { action as deleteAction } from '../routes/api.importer.delete'

// Bypass access control
vi.mock('../lib/access.server', () => ({
  requireHqShopOr404: vi.fn(async () => true),
}))

// Mutable state for prisma mock
let templatesById: Record<string, { importConfig: unknown }> = {}
let activePrepareIds: string[] = []
let publishInProgressTemplateIds: string[] = []

const fixedCounts = {
  logs: 5,
  staging: 10,
  sources: 20,
  runs: 2,
  diffs: 40,
}

beforeEach(() => {
  templatesById = {
    'tpl-1': { importConfig: { settings: { target: 'target-1' } } },
    'tpl-2': { importConfig: { settings: { target: 'target-2' } } },
  }
  activePrepareIds = []
  publishInProgressTemplateIds = []
})

// Prisma mock with minimal surface used by delete route
vi.mock('../db.server', () => {
  return {
    prisma: {
      importTemplate: {
        findMany: vi.fn(
          async ({ where, select }: { where?: { id?: { in?: string[] } }; select?: { importConfig?: boolean } }) => {
            // First call requests importConfig; second call checks preparingRunId
            const ids: string[] = where?.id?.in || []
            if (select?.importConfig) {
              return ids
                .filter(id => Boolean(templatesById[id]))
                .map(id => ({ id, importConfig: templatesById[id].importConfig }))
            }
            // preparingRunId check
            return activePrepareIds.filter(id => ids.includes(id)).map(id => ({ id }))
          },
        ),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      importLog: {
        count: vi.fn(async () => fixedCounts.logs),
        findMany: vi.fn(
          async ({ where }: { where: { templateId?: { in?: string[] }; type?: string; at?: { gte?: string } } }) => {
            const ids: string[] = where?.templateId?.in || []
            const hit = ids.filter(id => publishInProgressTemplateIds.includes(id))
            return hit.map(templateId => ({ templateId }))
          },
        ),
      },
      partStaging: {
        count: vi.fn(async () => fixedCounts.staging),
        deleteMany: vi.fn(async () => ({ count: fixedCounts.staging })),
      },
      productSource: {
        count: vi.fn(async () => fixedCounts.sources),
        deleteMany: vi.fn(async () => ({ count: fixedCounts.sources })),
      },
      importRun: {
        findMany: vi.fn(async () => [{ id: 'run-1' }, { id: 'run-2' }]),
        count: vi.fn(async () => fixedCounts.runs),
        deleteMany: vi.fn(async () => ({ count: fixedCounts.runs })),
      },
      importDiff: {
        count: vi.fn(async () => fixedCounts.diffs),
        deleteMany: vi.fn(async () => ({ count: fixedCounts.diffs })),
      },
    },
  }
})

// Map target id to supplier/site id
vi.mock('../server/importer/sites/targets', () => ({
  getTargetById: (id: string) => ({ id, siteId: id.replace('target', 'supplier') }),
}))

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('delete importer endpoint', () => {
  type ErrorResponse = { error: string; templates?: string[] }
  type OkResponse = { ok: boolean; dryRun?: boolean; deleted?: number; counts?: Record<string, unknown> }

  it('returns dry-run counts and supplier scope', async () => {
    const req = jsonRequest('http://localhost/api/importer/delete', { templateIds: ['tpl-1', 'tpl-2'], dryRun: true })
    const res = await deleteAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const j = (await res.json()) as OkResponse
    expect(j.ok).toBe(true)
    expect(j.dryRun).toBe(true)
    expect(j.counts).toBeTruthy()
  })

  it('blocks when prepare is active', async () => {
    activePrepareIds = ['tpl-1']
    const req = jsonRequest('http://localhost/api/importer/delete', { templateIds: ['tpl-1'] })
    const res = await deleteAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(409)
    const j = (await res.json()) as ErrorResponse
    expect(j.error).toMatch(/blocked/i)
    expect(j.templates).toContain('tpl-1')
  })

  it('blocks when publish is in progress', async () => {
    publishInProgressTemplateIds = ['tpl-2']
    const req = jsonRequest('http://localhost/api/importer/delete', { templateIds: ['tpl-2'] })
    const res = await deleteAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(409)
    const j = (await res.json()) as ErrorResponse
    expect(j.error).toMatch(/publish/i)
  })

  it('deletes templates and related artifacts', async () => {
    activePrepareIds = []
    publishInProgressTemplateIds = []
    const req = jsonRequest('http://localhost/api/importer/delete', { templateIds: ['tpl-1', 'tpl-2'] })
    const res = await deleteAction({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const j = (await res.json()) as OkResponse
    expect(j.ok).toBe(true)
    expect(j.deleted).toBe(2)
  })
})
