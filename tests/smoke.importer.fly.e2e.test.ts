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
  let seeded
  try {
    seeded = JSON.parse(body2 || '')
  } catch (e) {
    console.error('[smoke.fly] seed-diffs raw body:', body2)
    throw e
  }
  expect(seeded.ok).toBe(true)
  expect(seeded.ids.length).toBe(5)

  // Page 1
  await page.goto(`${BASE}/resources/smoke/importer/list-diffs?runId=${runId}&page=1&pageSize=2&token=${TOKEN}`)
  const body3 = await page.textContent('pre, body')
  let page1
  try {
    page1 = JSON.parse(body3 || '')
  } catch (e) {
    console.error('[smoke.fly] list-diffs page1 raw body:', body3)
    throw e
  }
  expect(page1.ok).toBe(true)
  expect(page1.page).toBe(1)
  expect(page1.rows.length).toBe(2)
  expect(page1.total).toBeGreaterThanOrEqual(5)

  // Page 2
  await page.goto(`${BASE}/resources/smoke/importer/list-diffs?runId=${runId}&page=2&pageSize=2&token=${TOKEN}`)
  const body4 = await page.textContent('pre, body')
  let page2
  try {
    page2 = JSON.parse(body4 || '')
  } catch (e) {
    console.error('[smoke.fly] list-diffs page2 raw body:', body4)
    throw e
  }
  expect(page2.ok).toBe(true)
  expect(page2.page).toBe(2)
  expect(page2.rows.length).toBe(2)

  // Diff detail for the first seeded id
  const firstId = seeded.ids[0]
  await page.goto(`${BASE}/resources/smoke/importer/get-diff?id=${firstId}&token=${TOKEN}`)
  const body4b = await page.textContent('pre, body')
  let detail
  try {
    detail = JSON.parse(body4b || '')
  } catch (e) {
    console.error('[smoke.fly] get-diff raw body:', body4b)
    throw e
  }
  expect(detail.ok).toBe(true)
  expect(detail.diff.id).toBe(firstId)
  expect(detail.diff.before).toBeTruthy()
  expect(detail.diff.after).toBeTruthy()

  // Run stats: ensure missingImagesTotal >= total (seeded after has no images)
  await page.goto(`${BASE}/resources/smoke/importer/run-stats?runId=${runId}&token=${TOKEN}`)
  const body4c = await page.textContent('pre, body')
  let stats
  try {
    stats = JSON.parse(body4c || '')
  } catch (e) {
    console.error('[smoke.fly] run-stats raw body:', body4c)
    throw e
  }
  expect(stats.ok).toBe(true)
  expect(stats.total).toBeGreaterThanOrEqual(5)
  expect(stats.missingImagesTotal).toBe(stats.total)

  // Simulate apply
  await page.goto(`${BASE}/resources/smoke/importer/apply?runId=${runId}&token=${TOKEN}`)
  const body5 = await page.textContent('pre, body')
  let applied
  try {
    applied = JSON.parse(body5 || '')
  } catch (e) {
    console.error('[smoke.fly] apply raw body:', body5)
    throw e
  }
  expect(applied.ok).toBe(true)
  expect(applied.runId).toBe(runId)
  expect(applied.changed).toBe(1)

  // Idempotency: second apply should be a no-op
  await page.goto(`${BASE}/resources/smoke/importer/apply?runId=${runId}&token=${TOKEN}`)
  const body5b = await page.textContent('pre, body')
  let applied2
  try {
    applied2 = JSON.parse(body5b || '')
  } catch (e) {
    console.error('[smoke.fly] apply(2) raw body:', body5b)
    throw e
  }
  expect(applied2.ok).toBe(true)
  expect(applied2.runId).toBe(runId)
  expect(applied2.changed).toBe(0)

  // Cleanup artifacts
  await page.goto(`${BASE}/resources/smoke/importer/cleanup?runId=${runId}&token=${TOKEN}`)
  const body6 = await page.textContent('pre, body')
  let cleaned
  try {
    cleaned = JSON.parse(body6 || '')
  } catch (e) {
    console.error('[smoke.fly] cleanup raw body:', body6)
    throw e
  }
  expect(cleaned.ok).toBe(true)
  expect(cleaned.deletedRuns).toBeGreaterThanOrEqual(1)
})
