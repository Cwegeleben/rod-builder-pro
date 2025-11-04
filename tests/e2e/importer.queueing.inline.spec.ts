/* Imports queueing e2e: show queued count while one run is preparing */
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

test('Shows queued count while a run is active', async ({ page }) => {
  await primeHqCookie(page)

  const runId = 'run-q-1'

  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        templates: [
          {
            id: 'tpl1',
            name: 'Batson Rod Blanks',
            state: 'READY',
            hadFailures: false,
            lastRunAt: null,
            preparing: { runId },
            hasSeeds: true,
            hasStaged: false,
            queuedCount: 1,
          },
        ],
      }),
    })
  })

  let hits = 0
  await page.route(`**/api/importer/runs/${runId}/status**`, async route => {
    hits++
    if (hits < 3) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'preparing',
          startedAt: new Date().toISOString(),
          preflight: { etaSeconds: 45 },
        }),
      })
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'staged' }) })
    }
  })

  const res = await page.goto(`${BASE}/app/imports${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)
  await app.locator('role=link[name="Batson Rod Blanks"]').waitFor({ state: 'visible' })

  // Queued indicator visible
  const queuedText = app.locator('text=• 1 queued')
  await expect(queuedText).toBeVisible()

  // While preparing, Review disabled
  const reviewBtn = app.locator('role=button[name="Review"]').first()
  await expect(reviewBtn).toBeDisabled()
})
