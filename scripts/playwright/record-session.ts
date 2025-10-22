/* Record a logged-in browser storageState to reuse for Playwright tests and HTTP preflights.
 * Usage:
 *   PW_BASE_URL=https://rbp-app.fly.dev TEST_QUERY='?embedded=1&host=...&shop=...' pnpm -s test:e2e:record-session
 * This will open a headed Chromium window. Complete any Shopify/Admin auth flow. Then return to terminal and press Enter to save.
 */
import { chromium } from 'playwright'
import * as fs from 'node:fs'
import * as path from 'node:path'

const BASE = process.env.PW_BASE_URL || process.env.BASE_URL
if (!BASE) {
  console.error('PW_BASE_URL or BASE_URL is required')
  process.exit(2)
}
const Q = process.env.TEST_QUERY ?? ''
const STORAGE_STATE = process.env.PW_STORAGE_STATE || 'tests/.auth/state.json'

async function ensureDir(p: string) {
  const dir = path.dirname(p)
  await fs.promises.mkdir(dir, { recursive: true })
}

async function main() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  const target = `${BASE}/app${Q}`
  console.log(`[record-session] Opening: ${target}`)
  await page.goto(target, { waitUntil: 'load' })
  console.log(
    '\nWhen you see the Admin UI loaded and authenticated, return here and press Enter to save the session...',
  )
  await new Promise<void>(resolve => {
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', () => resolve())
  })
  await ensureDir(STORAGE_STATE)
  await context.storageState({ path: STORAGE_STATE })
  console.log(`[record-session] Saved storage state to ${STORAGE_STATE}`)
  await browser.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
