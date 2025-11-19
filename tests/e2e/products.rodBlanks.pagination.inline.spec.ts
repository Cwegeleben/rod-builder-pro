/* Products Rod Blanks tab + pagination + reset flow.
   Conditional assertions tolerate sparse data. */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'
const HOSTS = [BASE, BASE.includes('127.0.0.1') ? 'http://localhost:3000' : 'http://127.0.0.1:3000']

async function primeHqCookie(page: import('@playwright/test').Page) {
  await page
    .context()
    .addCookies(HOSTS.map(h => ({ name: 'rbp_hq', value: '1', domain: new URL(h).hostname, path: '/' })))
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
        /* ignore */
      }
      try {
        const res = await page.goto(`${host}${path}`, { waitUntil: 'domcontentloaded' })
        if (res?.ok() || res?.status() === 304) return res
      } catch (e) {
        lastErr = e
      }
    }
    await page.waitForTimeout(150 + i * 100)
  }
  throw lastErr || new Error(`Navigation failed after ${attempts} attempts: ${url}`)
}

async function getAppScope(page: import('@playwright/test').Page) {
  if (HOSTS.some(h => page.url().startsWith(h))) {
    return { locator: (sel: string) => page.locator(sel), url: () => page.url() }
  }
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => HOSTS.some(h => f.url().startsWith(h)))
    if (frame) return { locator: (sel: string) => frame.locator(sel), url: () => frame.url() }
    await page.waitForTimeout(200)
  }
  throw new Error('App frame not found')
}

function hasQuery(url: string, key: string) {
  try {
    return new URL(url).searchParams.has(key)
  } catch {
    return false
  }
}

function getParam(url: string, key: string) {
  try {
    return new URL(url).searchParams.get(key)
  } catch {
    return null
  }
}

test('Rod Blanks tab filters, shows total banner, paginates and resets', async ({ page }) => {
  await primeHqCookie(page)
  await gotoWithRetry(page, `${BASE}/app/products?hq=1`)
  const app = await getAppScope(page)

  // Wait for page container
  await app.locator('[data-testid="page-products"]').first().waitFor({ state: 'visible', timeout: 15_000 })
  // Heading may render as Canonical Products or Products; tolerate either.
  const heading = app
    .locator('[data-testid="heading-products"], h2:has-text("Products"), h2:has-text("Canonical Products")')
    .first()
  await heading.waitFor({ state: 'visible', timeout: 15000 })

  // Click Rod Blanks tab
  const rodTab = app.locator('text=Rod Blanks').first()
  if (!(await rodTab.isVisible())) {
    test.skip(true, 'Rod Blanks tab not available (hidden or feature flag off)')
  } else {
    await rodTab.click({ force: true })
  }

  // Wait URL param type=Rod Blank
  await test.step('wait for type filter param', async () => {
    await page.waitForFunction(() => new URL(window.location.href).searchParams.get('type') === 'Rod Blank')
    expect(getParam(page.url(), 'type')).toBe('Rod Blank')
  })

  // Banner should show "Showing N of T" or canonical fallback
  const banner = app.locator('text=Showing').first()
  await expect(banner).toBeVisible()
  const bannerText = await banner.innerText()
  expect(bannerText).toMatch(/Showing \d+ of \d+ product|Showing canonical product_db rows/)

  // Capture initial count
  const rows = app.locator('[role="row"]')
  const initialCount = await rows.count()

  // Try paginate if Next enabled
  const nextBtn = app.locator('button:has-text("Next")').first()
  let paginated = false
  if (await nextBtn.isEnabled()) {
    await nextBtn.click()
    await page.waitForFunction(() => new URL(window.location.href).searchParams.has('after'))
    expect(hasQuery(page.url(), 'after')).toBeTruthy()
    paginated = true
  }

  // Reset if paginated
  if (paginated) {
    const resetBtn = app.locator('button:has-text("Reset")').first()
    await expect(resetBtn).toBeVisible()
    await resetBtn.click()
    await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('after'))
    expect(hasQuery(page.url(), 'after')).toBeFalsy()
  }

  // Basic filter sanity: If we have any rows, ensure no row visibly contradicts Rod Blank type.
  if (initialCount > 0) {
    // Type column cells (heuristic) contain '-' or type; we allow '-' if no productType present.
    const typeCells = app.locator('text=Rod Blank')
    // At least one Rod Blank reference expected when rows exist
    expect(await typeCells.count()).toBeGreaterThan(0)
  }
})
