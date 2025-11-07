/* Save & Crawl happy path e2e with mocked settings save + prepare */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const Q = '?hq=1'

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

// Ensure HQ override cookie is present for server-side HQ gate
async function primeHqCookie(page: import('@playwright/test').Page) {
  const host = new URL(BASE).hostname
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
}

test('Save & Crawl redirects with started params and starts progress polling', async ({ page }) => {
  await primeHqCookie(page)

  const templateId = 'tpl1'
  const runId = 'run-save-1'

  // Intercept settings save POST
  await page.route(`**/api/importer/targets/${templateId}/settings`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  // Intercept prepare POST
  await page.route('**/api/importer/prepare', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ runId, candidates: 7, etaSeconds: 60, expectedItems: 14 }),
    })
  })

  // Intercept imports list and status once redirected (optional sanity)
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ templates: [{ id: templateId, name: 'Batson Rod Blanks', state: 'READY' }] }),
    })
  })
  await page.route(`**/api/importer/runs/${runId}/status**`, async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'preparing' }) })
  })

  // No need to hook location.assign; we'll assert on final URL after navigation

  // Navigate to settings
  const res = await page.goto(`${BASE}/app/imports/${templateId}${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)

  // Fill seeds (Batson domain to satisfy seed scope guard)
  const seed = 'https://batsonenterprises.com/collections/blanks'
  // Prefer accessible label to locate the multiline TextField; fallback to label[for] when necessary
  let seedsField = app.getByLabel('Series URLs').first()
  if (!(await seedsField.count())) {
    const label = app.locator('label:has-text("Series URLs")').first()
    const inputId = await label.getAttribute('for')
    if (!inputId) test.skip(true, 'Series URLs field not found in this environment')
    seedsField = app.locator(`#${inputId}`)
  }
  await seedsField.fill(seed)

  // Click Save and Crawl
  await app.locator('role=button[name="Save and Crawl"]').click()

  // Expect a redirect to /app/imports with started params
  await page.waitForURL('**/app/imports**started=1**', { timeout: 15_000 })
  const current = page.url()
  const url = new URL(current, BASE)
  expect(url.pathname.endsWith('/app/imports')).toBeTruthy()
  expect(url.searchParams.get('started')).toBe('1')
  expect(url.searchParams.get('tpl')).toBe(templateId)
  expect(url.searchParams.get('c')).toBe('7')
  expect(url.searchParams.get('eta')).toBe('60')
  expect(url.searchParams.get('exp')).toBe('14')
})
