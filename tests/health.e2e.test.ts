import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:3000'

test('health endpoint returns ok', async ({ page }) => {
  await page.goto(`${BASE}/resources/health`)
  const body = await page.textContent('pre, body')
  expect(body).toBeTruthy()
  const json = JSON.parse(body!)
  expect(json.ok).toBe(true)
  expect(typeof json.ts).toBe('string')
})
