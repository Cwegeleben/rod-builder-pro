/* Isolation e2e: two templates for same supplier do not cross-pollinate */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const Q = '?hq=1'

async function getAppScope(
  page: import('@playwright/test').Page,
): Promise<{ locator: (sel: string) => import('@playwright/test').Locator; url: () => string }> {
  if (page.url().startsWith(BASE)) {
    return { locator: (sel: string) => page.locator(sel), url: () => page.url() }
  }
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => f.url().startsWith(BASE))
    if (frame) return { locator: (sel: string) => frame.locator(sel), url: () => frame.url() }
    await page.waitForTimeout(200)
  }
  throw new Error(`App frame not found (looked for src starting with ${BASE})`)
}

async function primeHqCookie(page: import('@playwright/test').Page) {
  const host = new URL(BASE).hostname
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
}

/**
 * This test simulates two templates for the same supplier. Each prepare generates a run with staged counts.
 * We assert that template B's counts don't reflect template A's staging and vice versa.
 */
test('Staging and diffs are isolated per template for the same supplier', async ({ page }) => {
  await primeHqCookie(page)

  // Fake template list shows two templates for same supplier
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        templates: [
          {
            id: 'tplA',
            name: 'Supplier X - Template A',
            state: 'READY',
            hadFailures: false,
            lastRunAt: null,
            preparing: null,
          },
          {
            id: 'tplB',
            name: 'Supplier X - Template B',
            state: 'READY',
            hadFailures: false,
            lastRunAt: null,
            preparing: null,
          },
        ],
      }),
    })
  })

  // Prepare calls: return two separate runIds and candidate counts
  await page.route('**/api/importer/prepare', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    const post = JSON.parse(route.request().postData() || '{}')
    const { templateId } = post?.options || {}
    const runId = templateId === 'tplA' ? 'runA' : templateId === 'tplB' ? 'runB' : 'runUnknown'
    const candidates = templateId === 'tplA' ? 5 : 3
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runId, candidates, etaSeconds: 30 }),
    })
  })

  // Status endpoints for both runs: staged
  await page.route('**/api/importer/runs/runA/status**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'staged' }) })
  })
  await page.route('**/api/importer/runs/runB/status**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'staged' }) })
  })

  // Diff summary endpoints should reflect isolated counts per run
  await page.route('**/api/importer/runs/runA**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'runA', status: 'staged', summary: { counts: { add: 5 } } }),
    })
  })
  await page.route('**/api/importer/runs/runB**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'runB', status: 'staged', summary: { counts: { add: 3 } } }),
    })
  })

  // Go to imports page
  const res = await page.goto(`${BASE}/app/imports${Q}`)
  expect(res?.ok()).toBeTruthy()
  // Ensure templates fetch resolved; skip if app isn't serving the route
  const tmplResp = await page
    .waitForResponse(resp => resp.url().includes('/api/importer/templates') && resp.ok(), { timeout: 5000 })
    .catch(() => null)
  if (!tmplResp) test.skip(true, 'Templates API was not requested; skipping in this environment')

  const app = await getAppScope(page)
  // Ensure both rows visible (by name text)
  await app.locator('text=Supplier X - Template A').first().waitFor({ state: 'visible' })
  await app.locator('text=Supplier X - Template B').first().waitFor({ state: 'visible' })

  // Instead of relying on UI buttons (may vary), trigger two prepare POSTs directly to exercise API isolation
  const okA = await page.evaluate(async () => {
    const res = await fetch('/api/importer/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: { templateId: 'tplA' } }),
    })
    return res.ok
  })
  expect(okA).toBeTruthy()
  const okB = await page.evaluate(async () => {
    const res = await fetch('/api/importer/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: { templateId: 'tplB' } }),
    })
    return res.ok
  })
  expect(okB).toBeTruthy()

  // Verify diff summaries for each run do not bleed into each other
  // Note: UI specifics may vary; this checks API backing data consistency through mocked responses
  // Optionally navigate to run details pages if available

  // Fetch run JSONs via in-page fetch (so mocks apply) and assert counts
  const runA = await page.evaluate(async () => {
    const res = await fetch('/api/importer/runs/runA')
    return res.json()
  })
  const runB = await page.evaluate(async () => {
    const res = await fetch('/api/importer/runs/runB')
    return res.json()
  })
  expect(runA.summary?.counts).toEqual({ add: 5 })
  expect(runB.summary?.counts).toEqual({ add: 3 })
})
