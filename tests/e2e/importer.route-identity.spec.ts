import { test, expect, request, type APIRequestContext } from '@playwright/test'

// This test asserts server-side diagnostic headers for schedule vs settings routes.
// It uses APIRequestContext to bypass UI and directly inspect document responses.
// NOTE: Settings route may require authenticated session; we assert schedule first and
// perform a best-effort check for settings (expecting either 200 with headers or 4xx without).

const BASE = process.env.PW_BASE_URL || 'https://rbp-app.fly.dev'
const TEMPLATE_ID = process.env.PW_TEMPLATE_ID || 'cmho2r6gr0002q0i5w2nl5rfw'

// Helper to fetch a URL and return status + selected headers.
async function fetchHeaders(ctx: APIRequestContext, url: string) {
  const resp = await ctx.get(url, { failOnStatusCode: false })
  return {
    status: resp.status(),
    route: resp.headers()['x-rbp-route'],
    template: resp.headers()['x-rbp-template'],
  }
}

test.describe('Importer route identity headers', () => {
  test('schedule route emits diagnostics headers', async () => {
    const ctx = await request.newContext()
    const url = `${BASE}/app/imports/${TEMPLATE_ID}/schedule`
    const h = await fetchHeaders(ctx, url)
    expect(h.status).toBe(200)
    expect(h.route).toBe('imports-schedule')
    expect(h.template).toBe(TEMPLATE_ID)
    await ctx.dispose()
  })

  test('settings index route presence (may be protected)', async () => {
    const ctx = await request.newContext()
    const url = `${BASE}/app/imports/${TEMPLATE_ID}`
    const h = await fetchHeaders(ctx, url)
    // Accept either protected 4xx or a 200 with proper header; document behavior.
    if (h.status === 200) {
      // If accessible, ensure header is present
      expect(h.route).toBe('imports-settings')
      expect(h.template).toBe(TEMPLATE_ID)
    } else {
      expect([401, 403, 404]).toContain(h.status)
    }
    await ctx.dispose()
  })
})
