import { test, expect } from '@playwright/test'

// Assumes HQ access via query param (?hq=1) is sufficient.
// Flow: create import -> settings page -> ensure metafields created/reported.

test('batson metafield definitions create & report', async ({ page }) => {
  // Navigate to new import form
  await page.goto('/app/imports/new?hq=1')
  await expect(page.getByText('Add import')).toBeVisible()
  const nameInput = page.getByPlaceholder('e.g., Batson Blanks')
  await nameInput.fill('Metafields Test Import')
  // Create import
  const createBtn = page.getByRole('button', { name: /Create import/i })
  await Promise.all([page.waitForURL(/\/app\/imports\/.+\?created=1/), createBtn.click()])
  // Metafield definitions section
  await expect(page.getByText('Batson Rod Blank Metafield Definitions')).toBeVisible()
  // If Missing badge present, click Create Missing
  const createMissing = page.getByRole('button', { name: /Create Missing/i })
  if (await createMissing.isVisible()) {
    await Promise.all([
      page.waitForResponse(r => /api\/importer\/metafields\/create/.test(r.url())),
      createMissing.click(),
    ])
  }
  // Re-test to refresh report
  const retestBtn = page.getByRole('button', { name: /Re-test/i })
  await Promise.all([page.waitForResponse(r => /api\/importer\/metafields\/report/.test(r.url())), retestBtn.click()])
  // Assert Defined: 16/16 and no Missing badge
  await expect(page.getByText(/Defined: 16\/16/)).toBeVisible()
  // Ensure Missing badge absent
  const missingBadge = page.getByText(/Missing:/)
  expect(await missingBadge.count()).toBe(0)
})
