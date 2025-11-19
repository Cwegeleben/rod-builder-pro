// <!-- BEGIN RBP GENERATED: importer-discover-headless-harden-v1 -->
import { chromium } from 'playwright'

type Options = {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  afterNavigateDelayMs?: number
  autoScroll?: boolean
  timeoutMs?: number
  // Optional: send Cookie header for authenticated views (e.g., wholesale pricing)
  cookieHeader?: string
}

export async function renderHeadlessHtml(url: string, opts: Options = {}) {
  const {
    waitUntil = 'networkidle',
    afterNavigateDelayMs = 400,
    autoScroll = true,
    timeoutMs = 15000,
    cookieHeader,
  } = opts
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
    ...(cookieHeader ? { extraHTTPHeaders: { Cookie: cookieHeader } as Record<string, string> } : {}),
  })
  const page = await context.newPage()
  try {
    // If cookieHeader provided, also persist cookies into context for subsequent requests
    if (cookieHeader) {
      const pairs = cookieHeader
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
      const cookies: Array<{ name: string; value: string; domain: string; path: string }> = []
      for (const p of pairs) {
        const eq = p.indexOf('=')
        if (eq <= 0) continue
        const name = p.slice(0, eq).trim()
        const value = p.slice(eq + 1).trim()
        if (!name || !value) continue
        cookies.push({ name, value, domain: '.batsonenterprises.com', path: '/' })
        cookies.push({ name, value, domain: 'batsonenterprises.com', path: '/' })
      }
      if (cookies.length) {
        // Cast to Playwright Cookie type shape minimally
        try {
          await context.addCookies(
            cookies as unknown as Array<{ name: string; value: string; domain: string; path: string }>,
          )
        } catch {
          /* ignore cookie persist errors */
        }
      }
    }
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
    // Wait for attribute grid stabilization: row count stable and at least some price text present
    const deadline = Date.now() + Math.max(afterNavigateDelayMs, 400) + 10_000
    let lastCount = -1
    while (Date.now() < deadline) {
      const { count, priceDigits } = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.table.attribute-grid tbody tr')
        let priceDigits = 0
        const priceEl = document.querySelector('table.table.attribute-grid tbody tr .price') as HTMLElement | null
        if (priceEl) {
          const txt = (priceEl.textContent || '').replace(/[^0-9]/g, '')
          priceDigits = txt.length
        }
        return { count: rows ? rows.length : 0, priceDigits }
      })
      if (count === lastCount && (priceDigits >= 2 || !cookieHeader)) break
      lastCount = count
      await page.waitForTimeout(300)
    }
    if (afterNavigateDelayMs > 0) await page.waitForTimeout(afterNavigateDelayMs)
    return await page.content()
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}
// <!-- END RBP GENERATED: importer-discover-headless-harden-v1 -->
