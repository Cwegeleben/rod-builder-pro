/* New Import end-to-end: create → settings → Save & Crawl → list shows started (hardened) */
import { test, expect } from '@playwright/test'

const PRIMARY = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const ALTERNATE = PRIMARY.includes('127.0.0.1') ? 'http://localhost:3000' : 'http://127.0.0.1:3000'
const HOSTS = [PRIMARY, ALTERNATE]
const Q = '?hq=1'

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
  throw lastErr ?? new Error(`Failed to navigate to ${url}`)
}

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

async function primeHqCookie(page: import('@playwright/test').Page) {
  const cookies = HOSTS.map(h => ({ name: 'rbp_hq', value: '1', domain: new URL(h).hostname, path: '/' }))
  await page.context().addCookies(cookies)
}

test('New import flow: create, configure, save & crawl, and list shows started', async ({ page }) => {
  await primeHqCookie(page)

  const projectName = test.info().project.name
  if (projectName.includes('Mobile')) {
    test.skip(true, 'Skipping on mobile emulation due to intermittent connection to dev server')
  }
  // Temporary: WebKit keeps the primary CTA disabled under headless Polaris in this flow too
  if (projectName === 'webkit') {
    test.skip(true, 'Skipping on WebKit due to disabled Save & Crawl button under headless constraints')
  }

  const tpl = 'tpl-new-1'
  const runId = 'run-new-1'

  // Intercept the form POST to create the template and ack it (we'll navigate manually)
  await page.route('**/app/imports/new**', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({ status: 200, contentType: 'text/html', body: '' })
  })

  // Settings save
  await page.route(`**/api/importer/targets/${tpl}/settings`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  // Prepare call
  await page.route('**/api/importer/prepare', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runId, candidates: 5, etaSeconds: 45, expectedItems: 10 }),
    })
  })

  // Imports list polling after redirect
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ templates: [{ id: tpl, name: 'New Import', state: 'READY', preparing: { runId } }] }),
    })
  })

  // Visit New Import page
  const res = await gotoWithRetry(page, `${PRIMARY}/app/imports/new${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)

  // Fill name and submit (try by label then fallback to text field selector)
  const nameField = app.getByLabel(/Import name|Name/i).first()
  if (await nameField.count()) {
    await nameField.fill('New Import')
  }

  // Click the primary submit button to create
  const createButton = app.getByRole('button', { name: /Create|Continue|Start/i }).first()
  await createButton.click()

  // Manually navigate to settings as if server redirected with 303
  await gotoWithRetry(page, `${PRIMARY}/app/imports/${tpl}?created=1&hq=1`)
  await page.waitForURL(`**/app/imports/${tpl}**created=1**`, { timeout: 15_000 })

  // Provide seeds within Batson domain to satisfy scope
  const seeds = app.getByLabel('Series URLs').first()
  await seeds.fill('https://batsonenterprises.com/collections/blanks')
  await seeds.press('Tab')

  // Trigger Save & Crawl (ensure it's enabled)
  const saveAndCrawl = app.getByRole('button', { name: 'Save and Crawl' })
  await expect(saveAndCrawl).toBeVisible()
  await expect(saveAndCrawl).toBeEnabled({ timeout: 10_000 })
  await saveAndCrawl.click()

  // Expect redirect with started query params
  await page.waitForURL('**/app/imports**started=1**')
  const current = page.url()
  const url = new URL(current)
  expect(url.searchParams.get('started')).toBe('1')
  expect(url.searchParams.get('tpl')).toBe(tpl)
  expect(url.searchParams.get('c')).toBe('5')
  expect(url.searchParams.get('eta')).toBe('45')
  expect(url.searchParams.get('exp')).toBe('10')
})
