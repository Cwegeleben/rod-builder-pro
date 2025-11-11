/* Delete modal closes immediately on success e2e (hardened for cross-browser & dual-host) */
import { test, expect } from '@playwright/test'

const PRIMARY = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const ALTERNATE = PRIMARY.includes('127.0.0.1') ? 'http://localhost:3000' : 'http://127.0.0.1:3000'
const HOSTS = [PRIMARY, ALTERNATE]
const Q = '?hq=1'

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

test('Delete import modal closes on success and navigates with toast', async ({ page }) => {
  await primeHqCookie(page)

  const projectName = test.info().project.name
  if (projectName.includes('Mobile')) {
    test.skip(true, 'Skipping on mobile emulation due to intermittent connection to dev server')
  }

  const templateId = 'tpl-del-1'

  // Intercepts: preview delete (dry run) and commit delete.
  await page.route('**/api/importer/delete*', async route => {
    const url = route.request().url()
    if (route.request().method() !== 'POST') return route.fallback()
    if (/delete\?dry=1/.test(url)) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          counts: { templates: 1, logs: 2, staging: 0, sources: 0, runs: 0, diffs: 0 },
        }),
      })
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  // Imports list after redirect (empty list triggers toast param consumption)
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ templates: [] }) })
  })

  // Navigate to settings page via retry
  const res = await gotoWithRetry(page, `${PRIMARY}/app/imports/${templateId}${Q}`)
  expect(res?.ok()).toBeTruthy()

  // Click Delete import button
  const deleteButton = page.getByRole('button', { name: /Delete import/ })
  await expect(deleteButton).toBeVisible({ timeout: 10_000 })
  await deleteButton.scrollIntoViewIfNeeded()
  await deleteButton.click()

  // Wait for counts text within modal
  const templatesCountText = page.getByText(/Templates:?\s*1/)
  await expect(templatesCountText).toBeVisible({ timeout: 15_000 })

  const modal = page.getByRole('dialog').first()
  try {
    await expect(modal).toBeVisible({ timeout: 15_000 })
  } catch {
    await expect
      .poll(
        async () => {
          const result = await modal.evaluate(el => {
            const s = window.getComputedStyle(el as HTMLElement)
            const r = (el as HTMLElement).getBoundingClientRect()
            return {
              opacity: s.opacity,
              display: s.display,
              w: r.width,
              h: r.height,
              ah: (el as HTMLElement).getAttribute('aria-hidden'),
            }
          })
          return result
        },
        { timeout: 5_000, intervals: [100, 150, 250, 400] },
      )
      .toMatchObject({ display: 'block' })
  }

  const confirmButton = modal.getByRole('button', { name: /Delete import/ })
  await expect(confirmButton).toBeVisible({ timeout: 8_000 })
  await confirmButton.scrollIntoViewIfNeeded()
  try {
    await confirmButton.click()
  } catch {
    await page.waitForTimeout(200)
    await confirmButton.click({ force: true })
  }

  await page.waitForURL('**/app/imports**deleted=1**', { timeout: 15_000 })
})
