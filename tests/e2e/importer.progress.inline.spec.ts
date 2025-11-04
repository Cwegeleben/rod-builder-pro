/* Imports progress e2e exercising started banner, queued/progress, and enabling Review when staged */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const Q = '?hq=1&started=1&tpl=tpl1&c=8&eta=45'

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

// Ensure HQ override cookie is present for server-side HQ gate
async function primeHqCookie(page: import('@playwright/test').Page) {
  const host = new URL(BASE).hostname
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
}

test('Imports list shows preparing state and enables Review when staged', async ({ page }) => {
  await primeHqCookie(page)

  const runId = 'run-prog-1'

  // Initial templates response shows one template with a preparing run
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
            queuedCount: 0,
          },
        ],
      }),
    })
  })

  // Poll status: first preparing, then staged
  let hits = 0
  await page.route(`**/api/importer/runs/${runId}/status**`, async route => {
    hits++
    if (hits < 2) {
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

  // Go to imports index with the started banner query
  const res = await page.goto(`${BASE}/app/imports${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)

  // The list row should be visible and Review disabled during preparing
  await app.locator('role=link[name="Batson Rod Blanks"]').waitFor({ state: 'visible' })
  const reviewBtn = app.locator('role=button[name="Review"]').first()
  await expect(reviewBtn).toBeVisible()
  await expect(reviewBtn).toBeDisabled()

  // A preparing indicator should be visible in the row
  await expect(app.locator('text=Preparing…').first()).toBeVisible()

  // After status flips to staged, the Review button becomes enabled
  await expect
    .poll(async () => (await reviewBtn.isEnabled()) && !(await app.locator('text=Preparing…').first().isVisible()), {
      timeout: 10_000,
    })
    .toBeTruthy()
})
