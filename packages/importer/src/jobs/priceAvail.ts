// <!-- BEGIN RBP GENERATED: importer-price-avail-job-v1 -->
import { chromium, type Cookie, type BrowserContext } from 'playwright'
import { prisma } from '../db'
// <!-- BEGIN RBP GENERATED: importer-price-diff-v1 (import) -->
import { diffPriceOnly } from '../pipelines/diffPriceOnly'
// <!-- END RBP GENERATED: importer-price-diff-v1 (import) -->
import { dec } from '../../../../app/services/crypto.server'
import { loadJar, saveJar } from '../auth/cookieJar'

async function getCreds(supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const c = await db.supplierCredentials.findFirst({ where: { supplierId } })
  if (!c) return null
  return { user: dec(c.usernameEnc), pass: dec(c.passwordEnc), totp: c.totpEnc ? dec(c.totpEnc) : undefined }
}

async function ensureLogin(context: BrowserContext, supplierId: string) {
  const jar = await loadJar(supplierId)
  if (jar) {
    const cookies: Cookie[] = JSON.parse(jar)
    await context.addCookies(cookies)
    return
  }
  const creds = await getCreds(supplierId)
  if (!creds) throw new Error('No supplier credentials saved')
  const page = await context.newPage()
  await page.goto('https://batsonenterprises.com/account/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"], input[name="username"]', creds.user)
  await page.fill('input[type="password"]', creds.pass)
  await page.click('button[type="submit"]')
  // TODO: handle TOTP input
  await page.waitForLoadState('networkidle').catch(() => {})
  const cookies = await context.cookies()
  await saveJar(supplierId, JSON.stringify(cookies))
  await page.close()
}

export async function runPriceAvailabilityRefresh(supplierId = 'batson') {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  try {
    await ensureLogin(context, supplierId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = prisma as any
    const urls: Array<{ url: string; externalId: string | null }> = await db.productSource.findMany({
      where: { supplierId },
      select: { url: true, externalId: true },
    })
    for (const { url, externalId } of urls) {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
      await page.waitForLoadState('networkidle').catch(() => {})
      const msrpText =
        (await page
          .locator(':text("MSRP"), :text("Price")')
          .first()
          .textContent()
          .catch(() => null)) || ''
      const costText =
        (await page
          .locator(':text("Dealer"), :text("Wholesale")')
          .first()
          .textContent()
          .catch(() => null)) || ''
      const availText =
        (await page
          .locator(':text("In Stock"), :text("Out of Stock"), :text("Availability")')
          .first()
          .textContent()
          .catch(() => null)) || ''

      const parseNum = (s: string) => {
        const m = s.match(/[\d,.]+/)
        if (!m) return null
        return Number(m[0].replace(/,/g, ''))
      }

      const priceMsrp = parseNum(msrpText)
      const priceWh = parseNum(costText)

      await db.partStaging.updateMany({
        where: externalId ? { supplierId, externalId } : { supplierId },
        data: {
          priceMsrp: priceMsrp ?? undefined,
          priceWh: priceWh ?? undefined,
          rawSpecs: JSON.parse(JSON.stringify({ availability: availText })) as unknown,
          fetchedAt: new Date(),
        },
      })
      await page.close()
    }
    // <!-- BEGIN RBP GENERATED: importer-price-diff-v1 -->
    await diffPriceOnly(supplierId)
    // <!-- END RBP GENERATED: importer-price-diff-v1 -->
  } finally {
    await context.close()
    await browser.close()
  }
}
// <!-- END RBP GENERATED: importer-price-avail-job-v1 -->
