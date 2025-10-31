// <!-- BEGIN RBP GENERATED: importer-discover-headless-harden-v1 -->
import { chromium } from 'playwright'

type Options = {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  afterNavigateDelayMs?: number
  autoScroll?: boolean
  timeoutMs?: number
}

export async function renderHeadlessHtml(url: string, opts: Options = {}) {
  const { waitUntil = 'networkidle', afterNavigateDelayMs = 400, autoScroll = true, timeoutMs = 15000 } = opts
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    viewport: { width: 1376, height: 768 },
    javaScriptEnabled: true,
  })
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil, timeout: timeoutMs })
    if (autoScroll) {
      await page.evaluate(async () => {
        await new Promise<void>(resolve => {
          let y = 0
          const step = () => {
            const h = (document.body.scrollHeight || document.documentElement.scrollHeight || 0) as number
            y = Math.min(y + 800, h)
            window.scrollTo(0, y)
            if (y >= h) return resolve()
            setTimeout(step, 120)
          }
          step()
        })
      })
    }
    if (afterNavigateDelayMs > 0) await page.waitForTimeout(afterNavigateDelayMs)
    return await page.content()
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}
// <!-- END RBP GENERATED: importer-discover-headless-harden-v1 -->
