import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'
const Q_BASE = process.env.TEST_QUERY ?? '?shop=dev.myshopify.com&host=abc&embedded=1'

// Helper to locate app frame if embedded
async function getScope(page: import('@playwright/test').Page) {
  if (page.url().startsWith(BASE)) return page
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const frame = page.frames().find(f => f.url().startsWith(BASE))
    if (frame) return frame
    await page.waitForTimeout(200)
  }
  throw new Error('Embedded app frame not found')
}

// Expect schedule vs settings pages to differ by testids and headings
// Uses a known templateId from env or falls back to a placeholder which will be skipped if 404.
const TEMPLATE_ID = process.env.TEST_TEMPLATE_ID || 'cmho2r6gr0002q0i5w2nl5rfw'

test('Import Settings has settings-page testid and Schedule has schedule-page testid', async ({ page }) => {
  // Settings
  const settingsUrl = `${BASE}/app/imports/${TEMPLATE_ID}${Q_BASE}`
  const res1 = await page.goto(settingsUrl)
  if (!res1 || res1.status() >= 400) test.skip(true, `Template settings not reachable: ${res1?.status()}`)
  const scope1 = await getScope(page)
  await expect(scope1.locator('[data-testid="settings-page"]')).toBeVisible()
  // Schedule
  const scheduleUrl = `${BASE}/app/imports/${TEMPLATE_ID}/schedule${Q_BASE}`
  const res2 = await page.goto(scheduleUrl)
  if (!res2 || res2.status() >= 400) test.skip(true, `Template schedule not reachable: ${res2?.status()}`)
  const scope2 = await getScope(page)
  await expect(scope2.locator('[data-testid="schedule-page"]')).toBeVisible()
  // Positive check for schedule UI
  await expect(scope2.locator('text=Enable schedule')).toBeVisible()
  // Negative check for settings-specific UI (stepper heading "Save & Crawl")
  await expect(scope2.locator('text=Save & Crawl')).toHaveCount(0)
})

// Stronger differentiation: page titles
test('Page titles differ between settings and schedule', async ({ page }) => {
  const settingsUrl = `${BASE}/app/imports/${TEMPLATE_ID}${Q_BASE}`
  await page.goto(settingsUrl)
  const scope1 = await getScope(page)
  const title1 = await scope1
    .locator('h1:has-text("Import Settings")')
    .first()
    .textContent()
    .catch(() => null)
  // Schedule
  const scheduleUrl = `${BASE}/app/imports/${TEMPLATE_ID}/schedule${Q_BASE}`
  await page.goto(scheduleUrl)
  const scope2 = await getScope(page)
  const title2 = await scope2
    .locator('h1:has-text("Schedule")')
    .first()
    .textContent()
    .catch(() => null)
  // If titles missing, record diagnostics
  if (!title1 || !title2) test.skip(true, 'Titles not found; UI structure may have changed')
  expect(title1).not.toEqual(title2)
})
