/* Delete import flow e2e: previews counts then confirms deletion and shows toast */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const HOSTS = [BASE, BASE.includes('127.0.0.1') ? 'http://localhost:3000' : 'http://127.0.0.1:3000']

async function primeHqCookie(page: import('@playwright/test').Page) {
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: new URL(BASE).hostname, path: '/' }])
}

async function gotoWithRetry(page: import('@playwright/test').Page, url: string, attempts = 10) {
  let lastErr: unknown
  const target = new URL(url, BASE)
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

test('Delete import preview + confirm shows toast', async ({ page }) => {
  await primeHqCookie(page)
  const tplId = 'tpl-del-1'

  // Mock dry-run preview
  await page.route('**/api/importer/delete?dry=1**', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        dryRun: true,
        counts: { templates: 1, logs: 2, staging: 3, sources: 4, runs: 5, diffs: 6 },
      }),
    })
  })
  // Mock final delete
  await page.route('**/api/importer/delete', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, deleted: 1, counts: { templates: 1 } }),
    })
  })

  const res = await gotoWithRetry(page, `${BASE}/app/imports/${tplId}?hq=1`)
  expect(res?.ok()).toBeTruthy()

  // Wait for Settings to render by heading, more robust than test id
  await page.getByRole('heading', { name: 'Import Settings' }).first().waitFor({ state: 'visible' })

  // Click Delete import… button
  await page.getByRole('button', { name: 'Delete import…' }).click()

  // Modal appears with counts from dry-run
  await expect(page.getByText('Delete this import and related data?').first()).toBeVisible()
  await expect(page.getByText('Templates: 1').first()).toBeVisible()
  await expect(page.getByText('Logs: 2').first()).toBeVisible()
  await expect(page.getByText('Staged items: 3').first()).toBeVisible()

  // Confirm deletion (target the modal's primary action specifically)
  await page.getByRole('dialog').getByRole('button', { name: 'Delete import', exact: true }).click()

  // Redirect to imports list with deleted=1 param triggers toast
  await expect
    .poll(async () => page.url().includes('/app/imports') && page.url().includes('deleted=1'), { timeout: 8000 })
    .toBeTruthy()

  // Toast should show "Import deleted"
  await expect(page.getByText('Import deleted').first()).toBeVisible()
})
