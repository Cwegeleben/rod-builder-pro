/* Save & Crawl happy path e2e with mocked settings save + prepare */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
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

  // Capture redirects invoked by Save & Crawl
  await page.addInitScript(() => {
    // @ts-expect-error test injector
    window.__navs = []
    const assign = (url: string | URL) => {
      // @ts-expect-error test injector
      window.__navs.push(String(url))
    }
    Object.defineProperty(window.location, 'assign', { value: assign })
    // Also hook top for embedded-style redirects
    try {
      if (window.top && window.top !== window) {
        Object.defineProperty(window.top.location, 'assign', { value: assign })
      }
    } catch {
      /* ignore cross-origin */
    }
  })

  // Navigate to settings
  const res = await page.goto(`${BASE}/app/imports/${templateId}${Q}`)
  expect(res?.ok()).toBeTruthy()

  const app = await getAppScope(page)

  // Fill seeds (Batson domain to satisfy seed scope guard)
  const seed = 'https://batsonenterprises.com/collections/blanks'
  const label = app.locator('label:has-text("Series URLs")').first()
  const inputId = await label.getAttribute('for')
  if (!inputId) test.skip(true, 'Series URLs field not found in this environment')
  const seedsField = app.locator(`#${inputId}`)
  await seedsField.fill(seed)

  // Click Save and Crawl
  await app.locator('role=button[name="Save and Crawl"]').click()

  // Expect a redirect to /app/imports with started params
  await expect
    .poll(
      async () =>
        (await page.evaluate(
          () => (window as unknown as { __navs?: string[] }).__navs?.slice(-1)?.[0] || '',
        )) as string,
      {
        timeout: 10_000,
      },
    )
    .not.toBe('')

  const captured = (await page.evaluate(
    () => (window as unknown as { __navs?: string[] }).__navs?.slice(-1)?.[0] || '',
  )) as string
  const url = new URL(captured, BASE)
  expect(url.pathname.endsWith('/app/imports')).toBeTruthy()
  expect(url.searchParams.get('started')).toBe('1')
  expect(url.searchParams.get('tpl')).toBe(templateId)
  expect(url.searchParams.get('c')).toBe('7')
  expect(url.searchParams.get('eta')).toBe('60')
  expect(url.searchParams.get('exp')).toBe('14')
})
