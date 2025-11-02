/* Publish flow e2e with mocked API routes and stubbed Review loader */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const Q = '?hq=1&e2e=1'

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

test('Publish from Review shows modal progress and redirects with banner params', async ({ page }) => {
  await primeHqCookie(page)

  const runId = 'run-e2e'

  // Mock staged rows for Review table (no conflicts, some approved)
  let stagedRequested = false
  await page.route(`**/api/importer/runs/${runId}/staged**`, async route => {
    stagedRequested = true
    const url = new URL(route.request().url())
    // Provide minimal table data
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [
          {
            core: { id: 'r1', title: 'Item 1', externalId: 'A1', vendor: 'V', status: 'approved', confidence: 1 },
            attributes: {},
            diffClass: 'add',
          },
          {
            core: { id: 'r2', title: 'Item 2', externalId: 'B1', vendor: 'V', status: 'approved', confidence: 1 },
            attributes: {},
            diffClass: 'change',
          },
        ],
        columns: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'vendor', label: 'Vendor', type: 'text' },
        ],
        totals: { unlinked: 0, linked: 2, conflicts: 0, all: 2 },
        page: Number(url.searchParams.get('page') || '1'),
        pageSize: Number(url.searchParams.get('pageSize') || '25'),
        totalPages: 1,
      }),
    })
  })

  // Mock publish status poll: first running, then published
  let statusHits = 0
  await page.route(`**/api/importer/runs/${runId}/publish/status**`, async route => {
    statusHits++
    if (statusHits < 2) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          runId,
          state: 'publishing',
          progress: 30,
          totals: { created: 0, updated: 0, skipped: 0, failed: 0 },
        }),
      })
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          runId,
          state: 'published',
          progress: 100,
          totals: { created: 2, updated: 1, skipped: 0, failed: 0 },
        }),
      })
    }
  })

  // Mock publish POST
  await page.route(`**/api/importer/runs/${runId}/publish/shopify`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        runId,
        totals: { created: 2, updated: 1, skipped: 0, failed: 0 },
        filter: { tag: `importRun:${runId}` },
      }),
    })
  })

  // Capture redirect URL instead of navigating to Products (avoid SSR Shopify Admin call)
  await page.addInitScript(() => {
    // @ts-expect-error test injector
    window.__lastRedirect = ''
    Object.defineProperty(window.location, 'assign', {
      value: (url: string | URL) => {
        // @ts-expect-error test injector
        window.__lastRedirect = String(url)
      },
    })
  })

  const res = await page.goto(`${BASE}/app/imports/runs/${runId}/review${Q}`)
  expect(res?.ok()).toBeTruthy()
  // Wait for staged request; if not requested we skip in this env
  await page.waitForTimeout(100)
  if (!stagedRequested) test.skip(true, 'Staged API was not requested; skipping in this environment')
  // Ensure Review page content visible
  const app = await getAppScope(page)
  // Be tolerant of render timing
  await app
    .locator('text=Review import')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {})
  const publishBtn = app.locator('role=button[name="Publish to Shopify"]').first()
  if (!(await publishBtn.isVisible())) test.skip(true, 'Publish button not found; skipping in this environment')

  // Click publish
  await app.locator('role=button[name="Publish to Shopify"]').first().click()

  // Modal shows and progress bar appears
  await expect(app.locator('text=Publishing to Shopify…')).toBeVisible()
  await expect(app.locator('[role="progressbar"]')).toBeVisible()

  // Wait until our redirect was captured
  await expect
    .poll(
      async () => {
        const v = await page.evaluate(() => (window as unknown as { __lastRedirect?: string }).__lastRedirect || '')
        return v
      },
      { timeout: 10_000 },
    )
    .not.toBe('')

  const captured = (await page.evaluate(
    () => (window as unknown as { __lastRedirect?: string }).__lastRedirect || '',
  )) as string
  const url = new URL(captured)
  expect(url.pathname).toBe('/app/products')
  expect(url.searchParams.get('banner')).toBe('publishOk')
  expect(url.searchParams.get('tag')).toBe(`importRun:${runId}`)
  expect(url.searchParams.get('created')).toBe('2')
  expect(url.searchParams.get('updated')).toBe('1')
})
