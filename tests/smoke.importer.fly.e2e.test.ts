import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'https://rbp-app.fly.dev'
const TOKEN = process.env.SMOKE_TOKEN || 'smoke-ok'

test('start run, seed diffs, paginate, apply (Fly smokes)', async ({ page }) => {
  // Start a run
  await page.goto(`${BASE}/resources/smoke/importer/start?token=${TOKEN}`)
  const body1 = await page.textContent('pre, body')
  const start = JSON.parse(body1!)
  expect(start.ok).toBe(true)
  const runId = start.runId as string
  expect(typeof runId).toBe('string')

  // Seed diffs
  await page.goto(`${BASE}/resources/smoke/importer/seed-diffs?runId=${runId}&count=5&token=${TOKEN}`)
  const body2 = await page.textContent('pre, body')
  const seeded = JSON.parse(body2!)
  expect(seeded.ok).toBe(true)
  expect(seeded.ids.length).toBe(5)

  // Page 1
  await page.goto(`${BASE}/resources/smoke/importer/list-diffs?runId=${runId}&page=1&pageSize=2&token=${TOKEN}`)
  const body3 = await page.textContent('pre, body')
  const page1 = JSON.parse(body3!)
  expect(page1.ok).toBe(true)
  expect(page1.page).toBe(1)
  expect(page1.rows.length).toBe(2)
  expect(page1.total).toBeGreaterThanOrEqual(5)

  // Page 2
  await page.goto(`${BASE}/resources/smoke/importer/list-diffs?runId=${runId}&page=2&pageSize=2&token=${TOKEN}`)
  const body4 = await page.textContent('pre, body')
  const page2 = JSON.parse(body4!)
  expect(page2.ok).toBe(true)
  expect(page2.page).toBe(2)
  expect(page2.rows.length).toBe(2)

  // Diff detail for the first seeded id
  const firstId = seeded.ids[0]
  await page.goto(`${BASE}/resources/smoke/importer/get-diff?id=${firstId}&token=${TOKEN}`)
  const body4b = await page.textContent('pre, body')
  const detail = JSON.parse(body4b!)
  expect(detail.ok).toBe(true)
  expect(detail.diff.id).toBe(firstId)
  expect(detail.diff.before).toBeTruthy()
  expect(detail.diff.after).toBeTruthy()

  // Run stats: ensure missingImagesTotal >= total (seeded after has no images)
  await page.goto(`${BASE}/resources/smoke/importer/run-stats?runId=${runId}&token=${TOKEN}`)
  const body4c = await page.textContent('pre, body')
  const stats = JSON.parse(body4c!)
  expect(stats.ok).toBe(true)
  expect(stats.total).toBeGreaterThanOrEqual(5)
  expect(stats.missingImagesTotal).toBe(stats.total)

  // Simulate apply
  await page.goto(`${BASE}/resources/smoke/importer/apply?runId=${runId}&token=${TOKEN}`)
  const body5 = await page.textContent('pre, body')
  const applied = JSON.parse(body5!)
  expect(applied.ok).toBe(true)
  expect(applied.runId).toBe(runId)
  expect(applied.changed).toBe(1)

  // Idempotency: second apply should be a no-op
  await page.goto(`${BASE}/resources/smoke/importer/apply?runId=${runId}&token=${TOKEN}`)
  const body5b = await page.textContent('pre, body')
  const applied2 = JSON.parse(body5b!)
  expect(applied2.ok).toBe(true)
  expect(applied2.runId).toBe(runId)
  expect(applied2.changed).toBe(0)

  // Cleanup artifacts
  await page.goto(`${BASE}/resources/smoke/importer/cleanup?runId=${runId}&token=${TOKEN}`)
  const body6 = await page.textContent('pre, body')
  const cleaned = JSON.parse(body6!)
  expect(cleaned.ok).toBe(true)
  expect(cleaned.deletedRuns).toBeGreaterThanOrEqual(1)
})
