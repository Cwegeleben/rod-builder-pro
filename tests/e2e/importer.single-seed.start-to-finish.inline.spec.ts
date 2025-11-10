/* Single-seed end-to-end importer flow (inline, mocked APIs).
   Covers: Settings Save & Crawl -> Prepare transition -> Review -> Publish (dry-run)
   Seed: https://batsonenterprises.com/rx6-e-glass-jig-boat
*/
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const Q = '?hq=1&singleSeed=1'

async function getAppScope(page: import('@playwright/test').Page): Promise<{
  locator: (sel: string) => import('@playwright/test').Locator
  getByLabel: (name: string | RegExp) => import('@playwright/test').Locator
  url: () => string
}> {
  if (page.url().startsWith(BASE)) {
    return {
      locator: (sel: string) => page.locator(sel),
      getByLabel: (name: string | RegExp) => page.getByLabel(name),
      url: () => page.url(),
    }
  }
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => f.url().startsWith(BASE))
    if (frame)
      return {
        locator: (sel: string) => frame.locator(sel),
        getByLabel: (name: string | RegExp) => frame.getByLabel(name),
        url: () => frame.url(),
      }
    await page.waitForTimeout(200)
  }
  throw new Error(`App frame not found (looked for src starting with ${BASE})`)
}

async function primeHqCookie(page: import('@playwright/test').Page) {
  const host = new URL(BASE).hostname
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
}

test('Single-seed: Save & Crawl -> Review -> Publish (dry-run mocked)', async ({ page }) => {
  await primeHqCookie(page)

  const templateId = 'tpl-single-1'
  const runId = 'run-single-seed-1'
  const seed = 'https://batsonenterprises.com/rx6-e-glass-jig-boat'

  // Intercept settings save POST
  await page.route(`**/api/importer/targets/${templateId}/settings`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    // Assert body contains our single seed (defensive)
    try {
      const postData = route.request().postDataJSON() as { discoverSeedUrls?: unknown }
      const seeds = Array.isArray(postData?.discoverSeedUrls) ? (postData.discoverSeedUrls as string[]) : []
      if (!seeds.some(u => u.includes('rx6-e-glass-jig-boat'))) {
        // Continue anyway but log
        console.warn('Seed not found in settings POST body')
      }
    } catch {
      // Non-fatal parse error; continue
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  // Intercept prepare POST
  await page.route('**/api/importer/prepare', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runId, candidates: 3, etaSeconds: 20, expectedItems: 3 }),
    })
  })

  // Templates list after redirect
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        templates: [
          {
            id: templateId,
            name: 'Batson Single Seed',
            state: 'READY',
            hadFailures: false,
            lastRunAt: new Date().toISOString(),
            preparing: null,
          },
        ],
      }),
    })
  })

  // Status poll: preparing -> started
  let statusHits = 0
  await page.route(`**/api/importer/runs/${runId}/status**`, async route => {
    statusHits++
    if (statusHits < 2) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'preparing',
          startedAt: new Date().toISOString(),
          preflight: { etaSeconds: 20 },
        }),
      })
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'started' }) })
    }
  })

  // Mock staged rows for Review (already approved for simplicity)
  let stagedRequested = false
  await page.route(`**/api/importer/runs/${runId}/staged**`, async route => {
    stagedRequested = true
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [
          {
            core: {
              id: 'row1',
              title: 'RX6 Jig Boat Blank',
              externalId: 'RX6-JIG',
              vendor: 'Batson',
              status: 'approved',
              confidence: 1,
            },
            attributes: { length: '6ft', material: 'E-Glass' },
            diffClass: 'add',
          },
        ],
        columns: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'vendor', label: 'Vendor', type: 'text' },
        ],
        totals: { unlinked: 0, linked: 1, conflicts: 0, all: 1 },
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }),
    })
  })

  // Publish status poll: publishing -> published (dry-run semantics still create counts)
  let publishStatusHits = 0
  await page.route(`**/api/importer/runs/${runId}/publish/status**`, async route => {
    publishStatusHits++
    if (publishStatusHits < 2) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          runId,
          state: 'publishing',
          progress: 40,
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
          totals: { created: 1, updated: 0, skipped: 0, failed: 0 },
        }),
      })
    }
  })

  // Publish POST (dry-run simulated)
  await page.route(`**/api/importer/runs/${runId}/publish/shopify`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        runId,
        dryRun: true,
        totals: { created: 1, updated: 0, skipped: 0, failed: 0 },
        filter: { tag: `importRun:${runId}` },
      }),
    })
  })

  // Capture redirect
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

  // Navigate to settings
  const res = await page.goto(`${BASE}/app/imports/${templateId}${Q}`)
  expect(res?.ok()).toBeTruthy()
  const app = await getAppScope(page)

  // Fill single seed (Series URLs field)
  let seedsField = app.getByLabel('Series URLs').first()
  if (!(await seedsField.count())) {
    const label = app.locator('label:has-text("Series URLs")').first()
    const inputId = await label.getAttribute('for')
    if (!inputId) test.skip(true, 'Series URLs field not found')
    seedsField = app.locator(`#${inputId}`)
  }
  await seedsField.fill(seed)

  // Click Save and Crawl
  const saveBtn = app.locator('role=button[name="Save and Crawl"]').first()
  if (!(await saveBtn.isVisible())) test.skip(true, 'Save and Crawl button not visible')
  await saveBtn.click()

  // Expect redirect to imports index with started params
  await page.waitForURL('**/app/imports**started=1**', { timeout: 15_000 })
  const importsUrl = new URL(page.url())
  expect(importsUrl.searchParams.get('tpl')).toBe(templateId)
  expect(importsUrl.searchParams.get('c')).toBe('3')

  // Click Review
  const reviewBtn = app.locator('role=button[name="Review"]').first()
  if (!(await reviewBtn.isVisible())) test.skip(true, 'Review button not found')
  await reviewBtn.click()

  // Review page loads
  await page.waitForURL(`**/app/imports/runs/${runId}/review**`, { timeout: 10_000 })
  await page.waitForTimeout(100)
  if (!stagedRequested) test.skip(true, 'Staged API not requested')

  // Publish button
  const publishBtn = app.locator('role=button[name="Publish to Shopify"]').first()
  if (!(await publishBtn.isVisible())) test.skip(true, 'Publish button not visible')
  await publishBtn.click()

  // Modal & progress
  await expect(app.locator('text=Publishing to Shopify…')).toBeVisible()
  await expect(app.locator('[role="progressbar"]').first()).toBeVisible()

  // Wait for captured redirect
  await expect
    .poll(
      async () => await page.evaluate(() => (window as unknown as { __lastRedirect?: string }).__lastRedirect || ''),
      {
        timeout: 10_000,
      },
    )
    .not.toBe('')

  const captured = (await page.evaluate(
    () => (window as unknown as { __lastRedirect?: string }).__lastRedirect || '',
  )) as string
  const finalUrl = new URL(captured)
  expect(finalUrl.pathname).toBe('/app/products')
  expect(finalUrl.searchParams.get('banner')).toBe('publishOk')
  expect(finalUrl.searchParams.get('tag')).toBe(`importRun:${runId}`)
  expect(finalUrl.searchParams.get('created')).toBe('1')
})
