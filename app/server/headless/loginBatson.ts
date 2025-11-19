import { chromium, type BrowserContext } from 'playwright'

export type LoginResult = {
  cookieHeader: string
}

/**
 * Headless login to Batson wholesale portal to acquire an authenticated cookie.
 * Requires env BATSON_USER and BATSON_PASS.
 */
export async function loginBatson(): Promise<LoginResult> {
  const email = process.env.BATSON_USER || process.env.BATSON_EMAIL || ''
  const password = process.env.BATSON_PASS || process.env.BATSON_PASSWORD || ''
  if (!email || !password) throw new Error('Missing BATSON_USER/BATSON_PASS')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  let context: BrowserContext | null = null
  try {
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
      viewport: { width: 1366, height: 768 },
      javaScriptEnabled: true,
    })
    const page = await context.newPage()
    await page.goto('https://batsonenterprises.com/user-login', { waitUntil: 'networkidle', timeout: 30_000 })

    // Try a few common selectors for Email/Password
    const emailSel = (await page.$('input[type="email"]'))
      ? 'input[type="email"]'
      : (await page.$('input[name="Email"]'))
        ? 'input[name="Email"]'
        : 'input#Email'
    const passSel = (await page.$('input[type="password"]'))
      ? 'input[type="password"]'
      : (await page.$('input[name="Password"]'))
        ? 'input[name="Password"]'
        : 'input#Password'

    await page.fill(emailSel, email)
    await page.fill(passSel, password)

    // Optional: stay logged in
    const remember =
      (await page.$('input[name="RememberMe"]')) ||
      (await page.$('input#RememberMe')) ||
      (await page.$('input[type="checkbox"][name*="remember" i]'))
    if (remember) {
      const checked = await remember.isChecked().catch(() => true)
      if (!checked) await remember.check().catch(() => {})
    }

    const submitBtn =
      (await page.$('button[type="submit"]')) ||
      (await page.$('input[type="submit"]')) ||
      (await page.$('button:has-text("Login")'))
    if (!submitBtn) throw new Error('Login submit button not found')
    await Promise.all([page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {}), submitBtn.click()])

    // Heuristic: wait for cookie to appear or redirect away from /user-login
    const start = Date.now()
    let haveCookie = false
    while (Date.now() - start < 30_000) {
      const cookies = await context.cookies('https://batsonenterprises.com')
      haveCookie = cookies.some(c => c.name.toLowerCase() === '.aspxauth' || c.name === '.ASPXAUTH')
      if (haveCookie) break
      // If still on login page, wait a bit more
      await page.waitForTimeout(500)
    }
    const cookies = await context.cookies('https://batsonenterprises.com')
    const header = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    if (!header) throw new Error('Login succeeded but no cookies captured')
    return { cookieHeader: header }
  } finally {
    try {
      await context?.close()
    } catch {
      /* ignore */
    }
    try {
      await browser.close()
    } catch {
      /* ignore */
    }
  }
}
