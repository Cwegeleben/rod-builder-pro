import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { spawn, ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const ENV_PROFILE = path.join(projectRoot, '.env.theme-editor-smoke')
const SMOKE_DEBUG = process.env.THEME_EDITOR_SMOKE_DEBUG === '1'

type SmokeResult = {
  name: string
  ok: boolean
  notes?: string
}

loadEnvProfile()

const baseUrl = stripTrailingSlash(process.env.SHOPIFY_APP_URL ?? 'http://127.0.0.1:3100')
const shopDomain = process.env.THEME_EDITOR_SMOKE_SHOP ?? 'core-sandbox.myshopify.com'
const designUrl = `${baseUrl}/apps/proxy/design?shop=${encodeURIComponent(shopDomain)}&rbp_theme=1`

async function main() {
  const server = startServer()
  try {
    await waitForServerReady(server)
    const browser = await chromium.launch()
    try {
      const results = await runChecks(browser)
      console.table(results)
      if (results.some(result => !result.ok)) {
        throw new Error('Theme Editor smoke failed')
      }
      console.log('[theme-editor:smoke] PASS')
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.error('[theme-editor:smoke] ERROR', error)
    process.exitCode = 1
  } finally {
    await shutdownServer(server)
  }
}

function loadEnvProfile() {
  if (!fs.existsSync(ENV_PROFILE)) {
    console.warn(`[theme-editor:smoke] Env profile missing at ${ENV_PROFILE}`)
    return
  }
  const lines = fs.readFileSync(ENV_PROFILE, 'utf8').split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!key || value.length === 0) continue
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
  console.log(`[theme-editor:smoke] Loaded env profile from ${ENV_PROFILE}`)
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function summarizeDraftRequests(requests: string[]) {
  return requests.reduce(
    (acc, method) => {
      if (method === 'POST') acc.post += 1
      if (method === 'PUT' || method === 'PATCH') acc.put += 1
      return acc
    },
    { post: 0, put: 0 },
  )
}

async function waitForDraftIndicator(page: Page, text: string, testId = 'blank-draft-status') {
  await page.getByTestId(testId).getByText(text).first().waitFor({ timeout: 10000 })
}

async function waitForDraftSaved(page: Page, testId = 'blank-draft-status') {
  await waitForDraftIndicator(page, 'Draft saved', testId)
}

function startServer(): ChildProcess {
  const child = spawn('npm', ['run', '-s', 'start'], {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.on('data', chunk => process.stderr.write(chunk))
  return child
}

function waitForServerReady(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleData = (chunk: Buffer) => {
      const text = chunk.toString()
      process.stdout.write(text)
      if (text.includes('listening on')) {
        cleanup()
        resolve()
      }
    }
    const handleExit = (code: number | null) => {
      cleanup()
      reject(new Error(`Server exited before ready (code ${code ?? 'null'})`))
    }
    const cleanup = () => {
      child.stdout?.off('data', handleData)
      child.off('exit', handleExit)
    }
    child.stdout?.on('data', handleData)
    child.once('exit', handleExit)
  })
}

function shutdownServer(child: ChildProcess | undefined | null): Promise<void> {
  if (!child || child.killed) {
    return Promise.resolve()
  }
  return new Promise(resolve => {
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
  })
}

async function runChecks(browser: Browser): Promise<SmokeResult[]> {
  const results: SmokeResult[] = []
  let failed = false

  async function capture(name: string, fn: () => Promise<string | void>) {
    try {
      const note = await fn()
      results.push({ name, ok: true, notes: note ?? undefined })
    } catch (error) {
      failed = true
      results.push({ name, ok: false, notes: error instanceof Error ? error.message : String(error) })
    }
  }

  await capture('Blank autosave flow', () => runBlankDraftFlow(browser))
  await capture('Blank persistence refresh', () => runBlankDraftPersistence(browser))
  await capture('Reel seat persistence refresh', () => runReelSeatDraftPersistence(browser))
  await capture('Blank autosave error recovery', () => runBlankDraftError(browser))
  await capture('Timeline renders', () => runTimelineHappy(browser))
  await capture('Timeline error + retry', () => runTimelineRetry(browser))
  await capture('No-JS SSR fallback', () => runNoJs(browser))

  if (failed) {
    console.error('[theme-editor:smoke] One or more checks failed')
  }

  return results
}

async function runTimelineHappy(browser: Browser): Promise<string> {
  const context = await browser.newContext()
  attachPageDebugLogging(context, 'timeline-happy')
  try {
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Published build timeline' }).waitFor({ timeout: 15000 })
    await page.getByText('Latest approved and in-progress builds for this shop.').waitFor({ timeout: 15000 })
    const rows = await page.locator('text=TE-TIMELINE-').allTextContents()
    if (rows.length < 3) {
      throw new Error(`Expected >=3 timeline rows, saw ${rows.length}`)
    }
    return `rows=${rows.length}`
  } finally {
    await context.close()
  }
}

async function runBlankDraftFlow(browser: Browser): Promise<string> {
  const context = await browser.newContext()
  context.addInitScript(() => window.localStorage.clear())
  const draftRequests: string[] = []
  attachPageDebugLogging(context, 'blank-flow')
  context.on('request', request => {
    if (request.url().includes('/api/design-studio/drafts')) {
      draftRequests.push(request.method())
    }
  })
  try {
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'networkidle' })
    const options = page.locator('[data-blank-option]')
    await options.first().waitFor({ timeout: 15000 })
    const optionCount = await options.count()
    if (optionCount < 2) {
      throw new Error('Need at least two blank options to validate autosave flow')
    }
    await options.first().click()
    await waitForDraftSaved(page)
    await options.nth(1).click()
    await waitForDraftSaved(page)
    const summary = summarizeDraftRequests(draftRequests)
    if (summary.post !== 1 || summary.put < 1) {
      throw new Error(`Unexpected draft calls (POST=${summary.post}, PUT=${summary.put})`)
    }
    await page.reload({ waitUntil: 'networkidle' })
    const persistedAttr = await page.locator('[data-blank-option]').nth(1).getAttribute('data-selected')
    if (persistedAttr !== 'true') {
      throw new Error('Blank selection did not persist after reload')
    }
    return `POST=${summary.post}, PUT=${summary.put}`
  } finally {
    await context.close()
  }
}

async function runBlankDraftError(browser: Browser): Promise<string> {
  const context = await browser.newContext()
  context.addInitScript(() => window.localStorage.clear())
  attachPageDebugLogging(context, 'blank-error')
  let shouldFailNext = true
  await context.route('**/api/design-studio/drafts**', async route => {
    const method = route.request().method()
    if (shouldFailNext && method === 'PUT') {
      shouldFailNext = false
      return route.fulfill({ status: 500, body: 'forced failure' })
    }
    return route.continue()
  })
  try {
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'networkidle' })
    const options = page.locator('[data-blank-option]')
    await options.first().waitFor({ timeout: 15000 })
    await options.first().click()
    await waitForDraftSaved(page)
    if ((await options.count()) < 2) {
      throw new Error('Need at least two blank options for error retry test')
    }
    await options.nth(1).click()
    await waitForDraftIndicator(page, 'Unable to save draft. Retry?', 'blank-draft-status')
    await page.getByTestId('blank-draft-status').getByRole('button', { name: 'Retry draft save' }).click()
    await waitForDraftSaved(page)
    return 'error->retry recovered'
  } finally {
    await context.close()
  }
}

async function runBlankDraftPersistence(browser: Browser): Promise<string> {
  const context = await browser.newContext()
  const draftRequests: string[] = []
  attachPageDebugLogging(context, 'blank-persist')
  context.on('request', request => {
    if (request.url().includes('/api/design-studio/drafts')) {
      draftRequests.push(request.method())
    }
  })
  const summarize = () => summarizeDraftRequests([...draftRequests])
  try {
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'networkidle' })
    const options = page.locator('[data-blank-option]')
    await options.first().waitFor({ timeout: 15000 })
    const optionCount = await options.count()
    if (optionCount < 2) {
      throw new Error('Need at least two blank options for persistence checks')
    }
    const firstOptionId = await options.first().getAttribute('data-blank-option')
    const secondOptionId = await options.nth(1).getAttribute('data-blank-option')
    if (!firstOptionId || !secondOptionId) {
      throw new Error('Unable to resolve blank option identifiers')
    }
    const optionById = (id: string) => page.locator(`[data-blank-option="${id}"]`)

    const initialCounts = summarize()
    if (initialCounts.post !== 0 || initialCounts.put !== 0) {
      throw new Error(`Draft calls fired before selection (POST=${initialCounts.post}, PUT=${initialCounts.put})`)
    }

    await optionById(firstOptionId).click()
    await waitForDraftSaved(page)
    const afterInitialSelect = summarize()
    if (afterInitialSelect.post !== 1 || afterInitialSelect.put !== 0) {
      throw new Error(
        `Initial blank select should POST once (POST=${afterInitialSelect.post}, PUT=${afterInitialSelect.put})`,
      )
    }

    await page.reload({ waitUntil: 'networkidle' })
    await optionById(firstOptionId).waitFor({ timeout: 15000 })
    await page.waitForFunction(
      locatorId =>
        document.querySelector(`[data-blank-option="${locatorId}"]`)?.getAttribute('data-selected') === 'true',
      firstOptionId,
      { timeout: 1500 },
    )
    const afterReload = summarize()
    if (afterReload.post !== afterInitialSelect.post || afterReload.put !== afterInitialSelect.put) {
      throw new Error('Draft writes occurred during reload hydration')
    }

    await optionById(secondOptionId).click()
    await waitForDraftSaved(page)
    const afterChange = summarize()
    const putDelta = afterChange.put - afterReload.put
    if (afterChange.post !== afterReload.post || putDelta !== 1) {
      throw new Error(
        `Changing blanks should emit exactly one PUT (POST=${afterChange.post - afterReload.post}, PUT Δ=${putDelta})`,
      )
    }

    await optionById(secondOptionId).click()
    await page.waitForTimeout(1500)
    const afterDuplicateClick = summarize()
    if (afterDuplicateClick.put !== afterChange.put) {
      throw new Error('Clicking already-selected blank emitted extra PUT')
    }

    return `phase3 persistence OK (POST=${afterDuplicateClick.post}, PUT=${afterDuplicateClick.put})`
  } finally {
    await context.close()
  }
}

async function runReelSeatDraftPersistence(browser: Browser): Promise<string> {
  const context = await browser.newContext()
  context.addInitScript(() => window.localStorage.clear())
  const draftRequests: string[] = []
  attachPageDebugLogging(context, 'reelseat-persist')
  context.on('request', request => {
    if (request.url().includes('/api/design-studio/drafts')) {
      draftRequests.push(request.method())
    }
  })
  const summarize = () => summarizeDraftRequests([...draftRequests])
  try {
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'networkidle' })
    const blankOptions = page.locator('[data-blank-option]')
    const reelSeatOptions = page.locator('[data-reel-seat-option]')
    await blankOptions.first().waitFor({ timeout: 15000 })
    await reelSeatOptions.first().waitFor({ timeout: 15000 })
    if ((await reelSeatOptions.count()) < 2) {
      throw new Error('Need at least two reel seat options for persistence check')
    }

    const firstBlankId = await blankOptions.first().getAttribute('data-blank-option')
    if (!firstBlankId) {
      throw new Error('Unable to resolve blank identifier')
    }

    const initialCounts = summarize()
    if (initialCounts.post !== 0 || initialCounts.put !== 0) {
      throw new Error(`Draft calls fired before selections (POST=${initialCounts.post}, PUT=${initialCounts.put})`)
    }

    await blankOptions.first().click()
    await waitForDraftSaved(page)
    const afterBlank = summarize()
    if (afterBlank.post !== 1 || afterBlank.put !== 0) {
      throw new Error(`Blank pick should POST once (POST=${afterBlank.post}, PUT=${afterBlank.put})`)
    }

    const firstReelSeatId = await reelSeatOptions.first().getAttribute('data-reel-seat-option')
    const secondReelSeatId = await reelSeatOptions.nth(1).getAttribute('data-reel-seat-option')
    if (!firstReelSeatId || !secondReelSeatId) {
      throw new Error('Unable to resolve reel seat identifiers')
    }
    const optionById = (id: string) => page.locator(`[data-reel-seat-option="${id}"]`)

    const beforeReelSelect = summarize()
    await optionById(firstReelSeatId).click()
    await waitForDraftSaved(page, 'reelseat-draft-status')
    const afterReelSelect = summarize()
    const reelPostDelta = afterReelSelect.post - beforeReelSelect.post
    const reelPutDelta = afterReelSelect.put - beforeReelSelect.put
    const validFirstReelWrite =
      (reelPostDelta === 0 && reelPutDelta === 1) || (reelPostDelta === 1 && reelPutDelta === 0)
    if (!validFirstReelWrite) {
      throw new Error(`Selecting reel seat should write once (POST Δ${reelPostDelta}, PUT Δ${reelPutDelta})`)
    }

    await page.reload({ waitUntil: 'networkidle' })
    await optionById(firstReelSeatId).waitFor({ timeout: 15000 })
    await page.waitForFunction(
      ({ blankId, reelId }: { blankId: string; reelId: string }) => {
        const blankSelected =
          document.querySelector(`[data-blank-option="${blankId}"]`)?.getAttribute('data-selected') === 'true'
        const reelSelected =
          document.querySelector(`[data-reel-seat-option="${reelId}"]`)?.getAttribute('data-selected') === 'true'
        return blankSelected && reelSelected
      },
      { blankId: firstBlankId, reelId: firstReelSeatId },
      { timeout: 2000 },
    )
    const afterReload = summarize()
    if (afterReload.post !== afterReelSelect.post || afterReload.put !== afterReelSelect.put) {
      throw new Error('Draft writes occurred during reload hydration for reel seat')
    }

    await optionById(secondReelSeatId).click()
    await waitForDraftSaved(page, 'reelseat-draft-status')
    const afterChange = summarize()
    const changePostDelta = afterChange.post - afterReload.post
    const changePutDelta = afterChange.put - afterReload.put
    if (!(changePostDelta === 0 && changePutDelta === 1)) {
      throw new Error(`Changing reel seat should PUT once (POST Δ${changePostDelta}, PUT Δ${changePutDelta})`)
    }

    await optionById(secondReelSeatId).click()
    await page.waitForTimeout(1500)
    const afterDuplicate = summarize()
    if (afterDuplicate.put !== afterChange.put || afterDuplicate.post !== afterChange.post) {
      throw new Error('Clicking selected reel seat emitted extra drafts traffic')
    }

    return `phase3 reel seat OK (POST=${afterDuplicate.post}, PUT=${afterDuplicate.put})`
  } finally {
    await context.close()
  }
}

async function runTimelineRetry(browser: Browser): Promise<string> {
  const context = await browser.newContext()
  attachPageDebugLogging(context, 'timeline-retry')
  try {
    let intercepted = false
    await context.route('**/api/design-studio/builds**', async route => {
      if (intercepted) {
        return route.continue()
      }
      intercepted = true
      console.warn('[theme-editor:smoke] Forcing timeline fetch failure')
      return route.abort('failed')
    })
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'domcontentloaded' })
    await page.getByText('Unable to load recent builds right now.').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Retry' }).click()
    await page.getByText('Latest approved and in-progress builds for this shop.').waitFor({ timeout: 15000 })
    const rows = await page.locator('text=TE-TIMELINE-').allTextContents()
    if (!rows.length) {
      throw new Error('Timeline did not repopulate after retry')
    }
    return `rows=${rows.length}`
  } finally {
    await context.close()
  }
}

async function runNoJs(browser: Browser): Promise<string> {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto(designUrl, { waitUntil: 'load' })
    await page.getByRole('heading', { name: 'Core Design Studio sandbox' }).waitFor({ timeout: 10000 })
    await page.getByRole('heading', { name: 'Active build summary' }).waitFor({ timeout: 10000 })
    await page.getByText('Timeline available once the Theme Editor assets finish loading.').waitFor({ timeout: 10000 })
    await page.getByText('Enable JavaScript to build a draft.').waitFor({ timeout: 10000 })
    return 'hero+active+timeline placeholders visible + blank warning'
  } finally {
    await context.close()
  }
}

main().catch(error => {
  console.error('[theme-editor:smoke] Unhandled error', error)
  process.exitCode = 1
})

function attachPageDebugLogging(context: BrowserContext, label: string) {
  if (!SMOKE_DEBUG) return
  context.addInitScript(() => {
    ;(globalThis as { __ENABLE_DS_DEBUG__?: boolean }).__ENABLE_DS_DEBUG__ = true
  })
  context.on('page', page => {
    page.on('console', message => {
      const type = message.type().toUpperCase()
      console.log(`[theme-editor:debug:${label}] console:${type}`, message.text())
    })
    page.on('request', request => {
      console.log(`[theme-editor:debug:${label}] request +`, request.method(), request.url())
    })
    page.on('requestfinished', request => {
      console.log(`[theme-editor:debug:${label}] request -`, request.method(), request.url())
    })
    page.on('requestfailed', request => {
      console.warn(
        `[theme-editor:debug:${label}] request x`,
        request.method(),
        request.url(),
        request.failure()?.errorText ?? 'unknown-error',
      )
    })
  })
}
