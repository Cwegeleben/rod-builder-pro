import { test, expect } from '@playwright/test'

// Prefer local webServer (Playwright will start it) unless PW_BASE_URL is provided.
const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:3000'

test('HQ 403 banner renders for non-HQ (unauth) request', async ({ page }) => {
  await page.goto(`${BASE}/hq-guard-test`)
  await expect(page.getByText('HQ access required', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Return to Products' })).toBeVisible()
})
