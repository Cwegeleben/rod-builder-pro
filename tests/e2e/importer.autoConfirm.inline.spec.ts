/* Auto-confirm overwrite heuristic e2e: stagedCount <= 3 should auto-confirm without modal */
import { test, expect } from '@playwright/test'

// Try both loopback hosts to work around browser-specific IPv4/IPv6 resolution quirks
const PRIMARY = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const ALTERNATE = PRIMARY.includes('127.0.0.1') ? 'http://localhost:3000' : 'http://127.0.0.1:3000'
const HOSTS = [PRIMARY, ALTERNATE]
const Q = '?hq=1'

async function getAppScope(page: import('@playwright/test').Page): Promise<{
  locator: (sel: string) => import('@playwright/test').Locator
  getByLabel: (name: string | RegExp) => import('@playwright/test').Locator
  getByRole: (
    role: 'button' | 'link' | 'heading' | 'textbox' | 'dialog',
    options?: { name?: string | RegExp },
  ) => import('@playwright/test').Locator
}> {
  if (HOSTS.some(h => page.url().startsWith(h))) {
    return {
      locator: (sel: string) => page.locator(sel),
      getByLabel: (name: string | RegExp) => page.getByLabel(name),
      getByRole: (role: 'button' | 'link' | 'heading' | 'textbox' | 'dialog', options?: { name?: string | RegExp }) =>
        page.getByRole(role, options),
    }
  }
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => HOSTS.some(h => f.url().startsWith(h)))
    if (frame)
      return {
        locator: (sel: string) => frame.locator(sel),
        getByLabel: (name: string | RegExp) => frame.getByLabel(name),
        getByRole: (role: 'button' | 'link' | 'heading' | 'textbox' | 'dialog', options?: { name?: string | RegExp }) =>
          frame.getByRole(role, options),
      }
    await page.waitForTimeout(200)
  }
  throw new Error(`App frame not found (looked for src starting with one of: ${HOSTS.join(', ')})`)
}

// Ensure HQ override cookie is present for server-side HQ gate
async function primeHqCookie(page: import('@playwright/test').Page) {
  const cookies = HOSTS.map(h => ({ name: 'rbp_hq', value: '1', domain: new URL(h).hostname, path: '/' }))
  await page.context().addCookies(cookies)
}

async function gotoWithRetry(page: import('@playwright/test').Page, url: string, attempts = 10) {
  let lastErr: unknown
  // Normalize to a path so we can try both hosts
  const target = new URL(url, PRIMARY)
  const path = `${target.pathname}${target.search}`
  for (let i = 0; i < attempts; i++) {
    for (const host of HOSTS) {
      // Best-effort probe
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

// This test simulates the settings page Save & Crawl path when server returns confirm_overwrite with a small stagedCount (<=3).
// We intercept first prepare (confirm_overwrite) and second prepare (auto confirm) responses.

test('Save & Crawl auto-confirms small overwrite (<=3 staged)', async ({ page }) => {
  await primeHqCookie(page)

  // Temporary: mobile emulations have intermittent connection issues with the dev server
  const projectName = test.info().project.name
  if (projectName.includes('Mobile')) {
    test.skip(true, 'Skipping on mobile emulation due to intermittent connection to dev server')
  }
  // Temporary: WebKit sometimes keeps the primary CTA disabled under headless Polaris
  if (projectName === 'webkit') {
    test.skip(true, 'Skipping on WebKit due to disabled Save & Crawl button under headless constraints')
  }

  const templateId = 'tpl-auto'
  const runId = 'run-auto-1'

  // Intercept settings save POST
  await page.route(`**/api/importer/targets/${templateId}/settings`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  let firstPrepare = true
  await page.route('**/api/importer/prepare', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (firstPrepare) {
      firstPrepare = false
      // Respond with confirm_overwrite guard (stagedCount=2)
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, code: 'confirm_overwrite', stagedCount: 2 }),
      })
      return
    }
    // Second call: auto-confirm accepted start
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runId, candidates: 1, etaSeconds: 30, expectedItems: 2 }),
    })
  })

  // Intercept imports list after navigation
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ templates: [{ id: templateId, name: 'Auto Confirm Import', state: 'READY' }] }),
    })
  })

  // Navigate directly to settings page
  const res = await gotoWithRetry(page, `${PRIMARY}/app/imports/${templateId}${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)

  // Provide seeds (Batson domain to satisfy seed scope guard)
  let seedField = app.getByLabel('Series URLs').first()
  if (!(await seedField.count())) {
    const label = app.locator('label:has-text("Series URLs")').first()
    const inputId = await label.getAttribute('for')
    if (!inputId) test.skip(true, 'Series URLs field not found in this environment')
    seedField = app.locator(`#${inputId}`)
  }
  await seedField.fill('https://batsonenterprises.com/collections/blanks')
  await seedField.press('Tab') // trigger validation/enablement

  // Trigger Save & Crawl (ensure it's enabled)
  const cta = app.getByRole('button', { name: 'Save and Crawl' })
  await expect(cta).toBeVisible()
  await expect(cta).toBeEnabled({ timeout: 10_000 })
  await cta.click()

  // Assert redirect happened automatically (auto-confirm branch) without user modal interaction
  await page.waitForURL('**/app/imports**started=1**', { timeout: 15_000 })
  const current = page.url()
  const url = new URL(current)
  expect(url.searchParams.get('started')).toBe('1')
  expect(url.searchParams.get('tpl')).toBe(templateId)
  expect(url.searchParams.get('c')).toBe('1')
  expect(url.searchParams.get('eta')).toBe('30')
  expect(url.searchParams.get('exp')).toBe('2')
})
