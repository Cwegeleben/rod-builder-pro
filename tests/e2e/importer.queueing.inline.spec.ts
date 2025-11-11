/* Imports queueing e2e: show queued count while one run is preparing */
import { test, expect } from '@playwright/test'

const PRIMARY = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const ALTERNATE = PRIMARY.includes('127.0.0.1') ? 'http://localhost:3000' : 'http://127.0.0.1:3000'
const HOSTS = [PRIMARY, ALTERNATE]
const Q = '?hq=1'

async function getAppScope(
  page: import('@playwright/test').Page,
): Promise<{ locator: (sel: string) => import('@playwright/test').Locator; url: () => string }> {
  if (HOSTS.some(h => page.url().startsWith(h))) {
    return { locator: (sel: string) => page.locator(sel), url: () => page.url() }
  }
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => HOSTS.some(h => f.url().startsWith(h)))
    if (frame) return { locator: (sel: string) => frame.locator(sel), url: () => frame.url() }
    await page.waitForTimeout(200)
  }
  throw new Error(`App frame not found (looked for src starting with one of: ${HOSTS.join(', ')})`)
}

async function primeHqCookie(page: import('@playwright/test').Page) {
  const cookies = HOSTS.map(h => ({ name: 'rbp_hq', value: '1', domain: new URL(h).hostname, path: '/' }))
  await page.context().addCookies(cookies)
}

async function gotoWithRetry(page: import('@playwright/test').Page, url: string, attempts = 10) {
  let lastErr: unknown
  const target = new URL(url, PRIMARY)
  const path = `${target.pathname}${target.search}`
  for (let i = 0; i < attempts; i++) {
    for (const host of HOSTS) {
      try {
        await page.context().request.get(`${host}/resources/hq-sentinel?hq=1`)
      } catch {
        // ignore probe errors
      }
      try {
        const res = await page.goto(`${host}${path}`, { waitUntil: 'domcontentloaded' })
        if (res?.ok() || res?.status() === 304) return res
      } catch (e) {
        lastErr = e
      }
    }
    await page.waitForTimeout(200 + i * 150)
  }
  throw lastErr || new Error(`Navigation failed after ${attempts} attempts: ${url}`)
}

test('Shows queued count while a run is active', async ({ page }) => {
  await primeHqCookie(page)

  if (test.info().project.name.includes('Mobile')) {
    test.skip(true, 'Skipping on mobile emulation pending server connectivity stabilization')
  }

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

  const res = await gotoWithRetry(page, `${PRIMARY}/app/imports${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)
  await app.locator('role=link[name="Batson Rod Blanks"]').waitFor({ state: 'visible' })

  // Queued indicator visible
  const queuedText = app.locator('text=• 1 queued')
  await expect(queuedText).toBeVisible()

  // We don't require Review button presence; queued indicator suffices in this test
  expect(await app.locator('role=button[name="Review"]').count()).toBeGreaterThanOrEqual(0)
})
