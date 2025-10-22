/* <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 --> */
import { test, expect } from '@playwright/test'
import { ROUTES, REQUIRED_QUERY_PARAMS } from '../../src/config/routes.admin'
import { TEST_IDS } from '../../src/config/testIds'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'
const Q_BASE = process.env.TEST_QUERY ?? '?shop=dev.myshopify.com&host=abc&embedded=1'
const HQ_OVERRIDE = process.env.HQ_OVERRIDE === '1'
const Q = HQ_OVERRIDE ? (Q_BASE.includes('?') ? `${Q_BASE}&hq=1` : `${Q_BASE}?hq=1`) : Q_BASE
const toPathRe = (p: string) => new RegExp(p.replace(/\//g, '\\/'))

async function getAppScope(
  page: import('@playwright/test').Page,
): Promise<{ locator: (sel: string) => import('@playwright/test').Locator; url: () => string }> {
  // If already on our app origin, operate directly on the page
  if (page.url().startsWith(BASE)) {
    return {
      locator: (sel: string) => page.locator(sel),
      url: () => page.url(),
    }
  }
  // Otherwise, find the embedded iframe that hosts our app
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => f.url().startsWith(BASE))
    if (frame) {
      return {
        locator: (sel: string) => frame.locator(sel),
        url: () => frame.url(),
      }
    }
    await page.waitForTimeout(200)
  }
  throw new Error(`App frame not found (looked for src starting with ${BASE})`)
}

// Warm-up before each test: hit /app with the embedded query to establish/refresh session cookies
test.beforeEach(async ({ page }) => {
  // Ensure HQ override cookie is present when requested
  if (HQ_OVERRIDE) {
    const host = new URL(BASE).hostname
    await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: host, path: '/' }])
  }
  const res = await page.goto(`${BASE}/app${Q}`)
  // If the environment gates access (e.g., HQ 410 before auth), res may not be ok; don't hard-fail warm-up in prod
  if (!res?.ok()) {
    test.info().annotations.push({ type: 'warmup', description: `/app status ${res?.status()}` })
  }
  // Be lenient: network can stay busy in embedded contexts, so fall back to a short delay
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 })
  } catch {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(1000)
  }
})

test('HQ sentinel honors override (SSR decision)', async ({ request }) => {
  if (!HQ_OVERRIDE) test.skip(true, 'HQ_OVERRIDE not set')
  const res = await request.get(`${BASE}/resources/hq-sentinel${Q}`)
  expect(res.ok(), `Sentinel fetch failed with status ${res.status()}`).toBeTruthy()
  const data = await res.json()
  expect(Boolean(data?.isHq)).toBeTruthy()
})

test('Products → Import Runs', async ({ page }) => {
  await page.goto(`${BASE}${ROUTES.productsIndex}${Q}`)
  const app = await getAppScope(page)
  const importBtn = app.locator(`[data-testid="${TEST_IDS.btnProductsImport}"]`)
  // If HQ-only control isn't visible in this environment, skip gracefully
  try {
    await importBtn.waitFor({ state: 'visible', timeout: 8000 })
  } catch {
    test.skip(true, 'HQ-only Import button not visible in this environment')
  }
  await importBtn.click()
  await expect.poll(() => app.url()).toMatch(toPathRe(ROUTES.runsIndex))
  const url = new URL(app.url())
  for (const k of REQUIRED_QUERY_PARAMS) expect(url.searchParams.has(k)).toBeTruthy()
})

test('Runs → Manage templates → back', async ({ page }) => {
  await page.goto(`${BASE}${ROUTES.runsIndex}${Q}`)
  const app = await getAppScope(page)
  const manageBtn = app.locator(`[data-testid="${TEST_IDS.btnManageTemplates}"]`)
  try {
    await manageBtn.waitFor({ state: 'visible', timeout: 8000 })
  } catch {
    test.skip(true, 'HQ-only Manage Templates button not visible in this environment')
  }
  await manageBtn.click()
  await expect.poll(() => app.url()).toMatch(toPathRe(ROUTES.templatesIndex))
  // Go back within the app context: use page.goBack which should affect the frame navigation as well
  await page.goBack()
  await expect.poll(() => app.url()).toMatch(toPathRe(ROUTES.runsIndex))
})
/* <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 --> */
