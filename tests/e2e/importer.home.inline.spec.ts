/* Imports home e2e: verify Recent runs table renders with friendly statuses, row navigation, and Schedule action */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'

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

test('Imports home shows Recent runs with friendly statuses and actions', async ({ page }) => {
  await primeHqCookie(page)

  // Keep Your imports minimal so Recent runs is visible without side effects
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ templates: [] }) })
  })

  const now = new Date().toISOString()
  const logs = [
    { at: now, templateId: 'tplA', runId: 'run-ready-1', type: 'prepare:consistency', payload: { diffCount: 5 } },
    { at: now, templateId: 'tplB', runId: 'run-pub-1', type: 'prepare:consistency', payload: { diffCount: 3 } },
  ]

  await page.route('**/api/importer/logs**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        logs,
        templateNames: {
          tplA: 'Import A',
          tplB: 'Import B',
        },
      }),
    })
  })

  // Status snapshots for the two runs
  await page.route('**/api/importer/runs/run-ready-1/status**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'staged', startedAt: now }) })
  })
  await page.route('**/api/importer/runs/run-pub-1/status**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'published', startedAt: now }),
    })
  })

  const res = await page.goto(`${BASE}/app/imports?hq=1`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)

  // Recent runs header
  await app.locator('role=heading[name="Recent runs"]').waitFor({ state: 'visible' })

  // Expect two rows present, with friendly badges
  await expect(app.locator('text=Import A')).toBeVisible()
  await expect(app.locator('text=Import B')).toBeVisible()
  await expect(app.locator('role=gridcell >> text=Ready')).toBeVisible()
  await expect(app.locator('role=gridcell >> text=Published')).toBeVisible()

  // Clicking a row navigates to Review for that run
  await app.locator(`role=row[name*="Import A"]`).click()
  await page.waitForURL(url => url.toString().includes('/app/imports/runs/run-ready-1/review'))

  // Go back
  await page.goto(`${BASE}/app/imports?hq=1`)
  await app.locator('role=heading[name="Recent runs"]').waitFor({ state: 'visible' })

  // Click Schedule on the Published row; should navigate to settings with schedule flag and NOT trigger row navigation
  const scheduleBtn = app.locator('role=button[name="Schedule"]').first()
  await expect(scheduleBtn).toBeVisible()
  // Accept the confirm dialog
  page.once('dialog', d => d.accept())
  await scheduleBtn.click()
  await page.waitForURL(url => url.toString().includes('/app/imports/tplB') && url.toString().includes('schedule=1'))
})
