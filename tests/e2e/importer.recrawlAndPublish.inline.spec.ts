/* Imports recrawl + publish e2e: exercises staged -> publishing progress -> published transition */
import { test, expect } from '@playwright/test'

const PRIMARY = process.env.PW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000'

async function primeHqCookie(page: import('@playwright/test').Page) {
  await page.context().addCookies([{ name: 'rbp_hq', value: '1', domain: new URL(PRIMARY).hostname, path: '/' }])
}

test('Imports list shows publishing progress after recrawl + publish', async ({ page }) => {
  await primeHqCookie(page)
  const runId = 'run-pub-1'
  const tplId = 'tpl-pub-1'

  // Initial templates: staged run ready for publish (simulate lastRunId)
  await page.route('**/api/importer/templates**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        templates: [
          {
            id: tplId,
            name: 'Example Template',
            state: 'APPROVED',
            hadFailures: false,
            lastRunAt: new Date().toISOString(),
            lastRunId: runId,
            hasSeeds: true,
            hasStaged: true,
            queuedCount: 0,
          },
        ],
      }),
    })
  })

  // Status polling: start at publishing 10%, progress to 55%, then published (no publishProgress)
  let hits = 0
  await page.route(`**/api/importer/runs/${runId}/status**`, async route => {
    hits++
    if (hits === 1) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'publishing', publishProgress: { processed: 1, target: 10, percent: 10 } }),
      })
      return
    }
    if (hits === 2) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'publishing', publishProgress: { processed: 5, target: 9, percent: 55 } }),
      })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'published' }) })
  })

  const res = await page.goto(`${PRIMARY}/app/imports?hq=1`)
  expect(res?.ok()).toBeTruthy()

  // Row visible
  const rowLink = page.locator('role=link[name="Example Template"]')
  await rowLink.waitFor({ state: 'visible' })

  // Badge shows Publishing 10% then updates to Publishing 55%, then disappears (status becomes published)
  await expect(page.getByText('Publishing').first()).toBeVisible()
  await expect(page.getByText(/10%/).first()).toBeVisible()

  await expect
    .poll(
      async () => {
        const fiftyFive = await page.getByText(/55%/).first().isVisible()
        return fiftyFive
      },
      { timeout: 8000 },
    )
    .toBeTruthy()

  // After third poll status becomes published -> publishing badge should eventually disappear
  await expect
    .poll(async () => !(await page.getByText('Publishing').first().isVisible()), { timeout: 8000 })
    .toBeTruthy()
})
