import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppLoadContext } from '@remix-run/node'

// Mock HQ guard to no-op
vi.mock('../lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => undefined) }))
// Mock admin token/client fetcher
vi.mock('../services/shopifyAdmin.server', () => ({
  getAdminClient: vi.fn(async () => ({ shopName: 'test-shop.myshopify.com', accessToken: 'shpat_test' })),
}))
// Mock metafields service helpers
vi.mock('../services/shopifyMetafields.server', () => ({
  getBatsonDefinitionReport: vi.fn(async () => ({ total: 16, missing: ['series'], present: [], statuses: [] })),
  createBatsonDefinitions: vi.fn(async () => ({ created: ['series'], errors: {} })),
}))

// Import after mocks in place
import { loader as reportLoader } from '../routes/api.importer.metafields.report'
import { action as createAction } from '../routes/api.importer.metafields.create'

function mkRequest(url: string, init?: RequestInit) {
  return new Request(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, ...init })
}

describe('Batson metafield definitions API', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('report loader: requires target=batson-rod-blanks', async () => {
    const req = mkRequest('http://localhost/api/importer/metafields/report')
    const res = await reportLoader({ request: req, params: {}, context: {} as AppLoadContext })
    expect(res.status).toBe(400)
  })

  it('report loader: returns report JSON when supported', async () => {
    const req = mkRequest('http://localhost/api/importer/metafields/report?target=batson-rod-blanks')
    const res = await reportLoader({ request: req, params: {}, context: {} as AppLoadContext })
    expect(res.status).toBe(200)
    const body = await (res as Response).json()
    expect(body?.report?.total).toBe(16)
    expect(Array.isArray(body?.report?.missing)).toBe(true)
  })

  it('create action: rejects unsupported intent/target', async () => {
    const form = new URLSearchParams({ intent: 'noop', target: 'batson-rod-blanks' })
    const req = mkRequest('http://localhost/api/importer/metafields/create', { method: 'POST', body: form })
    const res = await createAction({ request: req, params: {}, context: {} as AppLoadContext })
    expect(res.status).toBe(400)
  })

  it('create action: creates missing keys and returns created list', async () => {
    const form = new URLSearchParams({ intent: 'create', target: 'batson-rod-blanks' })
    const req = mkRequest('http://localhost/api/importer/metafields/create', { method: 'POST', body: form })
    const res = await createAction({ request: req, params: {}, context: {} as AppLoadContext })
    expect(res.status).toBe(200)
    const data = await (res as Response).json()
    expect(Array.isArray(data.created)).toBe(true)
  })
})
