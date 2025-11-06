import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getBatsonDefinitionReport, createBatsonDefinitions } from '../services/shopifyMetafields.server'

// Mock fetch sequence utility
type MockResp = { ok: boolean; status?: number; body: unknown }
function mockFetchSequence(responses: Array<MockResp>) {
  let i = 0
  global.fetch = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    return {
      ok: r.ok,
      status: r.status || (r.ok ? 200 : 422),
      statusText: r.ok ? 'OK' : 'Unprocessable Entity',
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
      json: async () => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body),
    } as unknown as Response
  })
}

describe('metafields report fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  it('uses GraphQL fallback when REST returns empty', async () => {
    mockFetchSequence([
      // First broad REST (empty)
      { ok: true, body: { metafield_definitions: [] } },
      // Second owner_type REST (empty)
      { ok: true, body: { metafield_definitions: [] } },
      // GraphQL fallback
      {
        ok: true,
        body: {
          data: {
            metafieldDefinitions: {
              edges: [
                {
                  node: {
                    id: '1',
                    name: 'Series',
                    key: 'series',
                    namespace: 'rbp_spec',
                    type: 'single_line_text_field',
                    ownerType: 'PRODUCT',
                  },
                },
              ],
            },
          },
        },
      },
    ])
    const report = await getBatsonDefinitionReport('example.myshopify.com', 'shpat_test')
    expect(report.present).toContain('series')
    expect(report.missing).not.toContain('series')
  })

  it('treats duplicate creation errors as success', async () => {
    mockFetchSequence([
      // Initial list (empty to force creation)
      { ok: true, body: { metafield_definitions: [] } },
      { ok: true, body: { metafield_definitions: [] } },
      // Creation attempt for 'series' returns duplicate error 422
      { ok: false, status: 422, body: { errors: { key: ['has already been taken'] } } },
    ])
    const { created, errors } = await createBatsonDefinitions('example.myshopify.com', 'shpat_test', false)
    expect(created).toContain('series')
    expect(errors.series).toBeUndefined()
  })
})
