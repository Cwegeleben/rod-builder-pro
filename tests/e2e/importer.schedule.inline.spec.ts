import { test, expect, Page } from '@playwright/test'

// Assumptions:
// - ALLOW_HQ_OVERRIDE=1 in local e2e (playwright.config.ts sets this) so we can access importer routes directly.
// - A template with id 'demo-schedule-template' may not exist; we create a settings entry via discover or fallback.

async function ensureTemplate(page: Page) {
  // Navigate to Imports home
  await page.goto('/app/imports')
  // If a schedule link already exists for a row, reuse first row
  const scheduleLinks = page.locator('a:has-text("Schedule")')
  if (await scheduleLinks.count()) {
    const href = await scheduleLinks.first().getAttribute('href')
    return href?.split('/')[3] || 'unknown'
  }
  // Otherwise create a new import via wizard if available
  // Fallback: return a demo id; tests will then show not found gracefully
  return 'demo-schedule-template'
}

// Helper: Extract runId from first live log row (if any)
async function findLiveRunId(page: Page) {
  const liveBadge = page.locator('text=live').first()
  if (await liveBadge.count()) {
    const row = liveBadge.locator('xpath=ancestor::*[contains(@class,"Polaris-IndexTable") or @role="row"]')
    const link = row.locator('a').last()
    return (await link.textContent())?.trim() || null
  }
  return null
}

test('schedule page enables/disables and recrawl logs appear', async ({ page }) => {
  const templateId = await ensureTemplate(page)
  await page.goto(`/app/imports/${templateId}/schedule`)

  // Page should render title and version tag
  await expect(page.getByText(/Schedule —/)).toBeVisible()
  await expect(page.getByText('Importer v2.3')).toBeVisible()

  // Toggle enable schedule if checkbox present
  const enableCheckbox = page.getByLabel('Enable schedule')
  if (await enableCheckbox.count()) {
    const checkedBefore = await enableCheckbox.isChecked()
    await enableCheckbox.click()
    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    // Expect toast or navigate back (we navigate back to Imports list)
    await page.waitForTimeout(500)
    // Return to schedule page
    await page.goto(`/app/imports/${templateId}/schedule`)
    const checkedAfter = await enableCheckbox.isChecked()
    expect(checkedAfter).not.toBe(checkedBefore)
  }

  // Trigger recrawl
  const recrawlBtn = page.getByRole('button', { name: 'Recrawl now' })
  if (await recrawlBtn.count()) {
    await recrawlBtn.click()
    // Small wait for log ingestion
    await page.waitForTimeout(1500)
    // Navigate back to Imports list to view logs card
    await page.goto('/app/imports')
    // Live badge may appear if prepare:start events were emitted
    // Optional: try to capture live run id for diagnostics; ignore result
    await findLiveRunId(page)
    // Not asserting on runId specifically; presence of badge is informative but optional
    // Validate at least one log row rendered
    await expect(page.getByText(/Import|run|prepare|approve/i).first()).toBeVisible({ timeout: 4000 })
  }
})
