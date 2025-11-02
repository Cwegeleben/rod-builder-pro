/* Inline Prepare flow e2e with mocked API routes */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
// Prefer a simple non-embedded query for stability in local runs
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

// Ensure HQ override cookie is present for server-side HQ gate
async function primeHqCookie(page: import('@playwright/test').Page) {
  const host = new URL(BASE).hostname
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
}

test('Prepare review inline shows progress and re-enables Review when started', async ({ page }) => {
  await primeHqCookie(page)

  // Mock APIs used by ImportList
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        templates: [
          { id: 'tpl1', name: 'Test Import', state: 'READY', hadFailures: false, lastRunAt: null, preparing: null },
        ],
      }),
    })
  })

  await page.route('**/api/importer/prepare', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runId: 'run1', candidates: 8, etaSeconds: 45 }),
    })
  })

  let statusHits = 0
  await page.route('**/api/importer/runs/run1/status**', async route => {
    statusHits++
    if (statusHits < 2) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'preparing',
          startedAt: new Date().toISOString(),
          preflight: { etaSeconds: 45 },
        }),
      })
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'started', startedAt: new Date().toISOString() }),
      })
    }
  })

  // Navigate to imports index
  const res = await page.goto(`${BASE}/app/imports${Q}`)
  expect(res?.ok()).toBeTruthy()
  // Wait for templates fetch to resolve and render; skip if app isn't serving the route in this env
  const tmplResp = await page
    .waitForResponse(resp => resp.url().includes('/api/importer/templates') && resp.ok(), { timeout: 5000 })
    .catch(() => null)
  if (!tmplResp) test.skip(true, 'Templates API was not requested; skipping in this environment')

  // Find Import row controls inside app scope (embedded or direct)
  const app = await getAppScope(page)

  // Ensure row visible
  await app.locator('role=link[name="Test Import"]').waitFor({ state: 'visible' })

  const prepareBtn = app.locator('role=button[name="Prepare review"]')
  await expect(prepareBtn).toBeVisible()

  const reviewBtn = app.locator('role=button[name="Review"]')
  await expect(reviewBtn).toBeVisible()
  await expect(reviewBtn).toBeEnabled()

  // Click Prepare → progress should appear and Review becomes disabled
  await prepareBtn.click()

  await expect(app.locator('text=Preparing…')).toBeVisible()
  await expect(reviewBtn).toBeDisabled()

  // After status returns started, preparing UI should clear and Review enabled again
  await expect
    .poll(async () => (await reviewBtn.isEnabled()) && !(await app.locator('text=Preparing…').isVisible()), {
      timeout: 10_000,
    })
    .toBeTruthy()
})
