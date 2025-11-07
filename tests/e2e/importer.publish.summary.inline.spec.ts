/* Import Logs publish summary e2e: validates publish:* filter and summary rendering */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const Q = '?hq=1&e2e=1'

async function primeHqCookie(page: import('@playwright/test').Page) {
  const host = new URL(BASE).hostname
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
}

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

test('Import Logs filter Publish shows publish:* summaries', async ({ page }) => {
  await primeHqCookie(page)

  // Mock importer templates list minimal to allow page render
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        templates: [
          {
            id: 'tpl1',
            name: 'Fixture Import',
            state: 'READY',
            hadFailures: false,
            lastRunAt: null,
            preparing: null,
            hasSeeds: true,
            hasStaged: false,
            queuedCount: 0,
          },
        ],
      }),
    })
  })

  // Provide initial logs with publish:start + publish:done and some other noise
  const now = new Date().toISOString()
  const logsPayload = {
    logs: [
      { at: now, templateId: 'tpl1', runId: 'run-pub-1', type: 'prepare:start', payload: { c: 2 } },
      { at: now, templateId: 'tpl1', runId: 'run-pub-1', type: 'publish:start', payload: {} },
      {
        at: now,
        templateId: 'tpl1',
        runId: 'run-pub-1',
        type: 'publish:done',
        payload: { totals: { created: 2, updated: 1, skipped: 0, failed: 0 } },
      },
      { at: now, templateId: 'tpl1', runId: 'run-pub-1', type: 'approve', payload: { published: 3 } },
    ],
  }

  await page.route('**/api/importer/logs**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(logsPayload) })
  })
  // Stream can send an empty set; we ignore
  await page.route('**/api/importer/logs/stream**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: 'data: {"logs":[]}\n\n',
    })
  })

  const res = await page.goto(`${BASE}/app/imports${Q}&type=publish`)
  expect(res?.ok()).toBeTruthy()
  const app = await getAppScope(page)

  // Click Refresh to fetch logs (client-side merge)
  const refresh = app.locator('role=button[name="Refresh"]')
  await refresh.click()

  // Expect summary text created 2 • updated 1 to appear (may be truncated but should include created 2 and updated 1)
  await expect(app.locator('text=/created 2/')).toBeVisible()
  await expect(app.locator('text=/updated 1/')).toBeVisible()

  // Non-publish types should be filtered out (approve badge label 'success', prepare progress row)
  // We assert absence of 'prepare' summary snippet ("2 candidates") to ensure filtering
  await expect(app.locator('text=/candidates/')).toHaveCount(0)
})
