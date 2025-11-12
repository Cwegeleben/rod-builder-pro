import { test, expect } from '@playwright/test'

// Fly base URL for embedded app (outside iframe we hit direct app URL)
const BASE = process.env.FLY_BASE || 'https://rbp-app.fly.dev'
// Template to open settings for; user provided a deep settings link with a runId query
// We allow passing FLY_TEMPLATE_ID or a full path via FLY_SETTINGS_PATH
const TEMPLATE_ID = process.env.FLY_TEMPLATE_ID || ''
const SETTINGS_PATH = process.env.FLY_SETTINGS_PATH || ''

// Helper: wait for toast text to appear
import type { Page } from '@playwright/test'
async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 8000 })
}

test.describe('Importer Settings on Fly', () => {
  test('save, crawl, cancel, recrawl flows', async ({ page }) => {
    test.slow()
    const url = SETTINGS_PATH
      ? `${BASE}${SETTINGS_PATH}`
      : `${BASE}/app/imports/${encodeURIComponent(TEMPLATE_ID)}?hq=1`

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    // Basic smoke: page loads and shows heading
    await expect(page.getByTestId('settings-page')).toBeVisible()

    // Save settings (no-op save): click Save and expect toast
    const saveBtn = page.getByRole('button', { name: /^Save$/ })
    await saveBtn.click()
    await expectToast(page, 'Settings saved')

    // Crawl & Update: should start prepare run and navigate with started/runId params
    const crawlBtn = page.getByRole('button', { name: /Crawl\s*&\s*Update/ })
    await crawlBtn.click()

    // After click we expect UI to show an active run badge or progress block
    // Wait for either: run badge, progress percent, or connection badge
    const runBadge = page.getByText(/^Run:\s*[a-z0-9]{8}/i)
    const progressPct = page.getByText(/Progress:\s*\d+%/i)
    await expect(runBadge.or(progressPct)).toBeVisible({ timeout: 30000 })

    // Optional: Cancel the run to verify cancel endpoint works
    const cancelBtn = page.getByRole('button', { name: /^Cancel$/ })
    await cancelBtn.click()
    // After cancel, badge may remain but finished state should appear eventually or no heartbeat
    // Give it some time but don't fail test if it continues running (best-effort)
    await page.waitForTimeout(2000)

    // Recrawl + Publish opens confirm modal; exercise open/close path
    const recrawlBtn = page.getByRole('button', { name: /Recrawl\s*\+\s*Publish/ })
    await recrawlBtn.click()
    // Modal should open; then dismiss to avoid running publish in prod
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    const dismiss = page.getByRole('button', { name: /Cancel|Dismiss|Close/ })
    await dismiss.click()
    await expect(modal).toBeHidden()

    // Expand Details if present
    const detailsSummary = page.getByText(/^Details$/)
    if (await detailsSummary.isVisible()) {
      await detailsSummary.click()
    }

    // Logs tail appears; just ensure the container exists
    await expect(page.getByText(/Recent log tail/i)).toBeVisible()
  })
})
