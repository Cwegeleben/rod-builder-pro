import { test, expect } from '@playwright/test'
import { PrismaClient, DesignStudioTier } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || `file:${process.cwd()}/.tmp/e2e.sqlite`
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
const SANDBOX_SHOP = 'batson.myshopify.com'

test.beforeAll(async () => {
  await prisma.tenantSettings.upsert({
    where: { shopDomain: SANDBOX_SHOP },
    update: {
      designStudioEnabled: true,
      designStudioTier: DesignStudioTier.PLUS,
      designStudioConfig: {},
    },
    create: {
      shopDomain: SANDBOX_SHOP,
      designStudioEnabled: true,
      designStudioTier: DesignStudioTier.PLUS,
      designStudioConfig: {},
    },
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test.describe('Design Studio storefront proxy', () => {
  test('renders hero copy and allows build drawer interactions', async ({ page }) => {
    await page.goto(`/apps/proxy/design?shop=${SANDBOX_SHOP}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Design Studio|Design your Rainshadow build/ })).toBeVisible()

    // Ensure selector content loads and a component can be chosen
    const blankCardHeading = page.getByRole('heading', { name: 'Rainshadow Eternity RX10 7\'11" ML' })
    await expect(blankCardHeading).toBeVisible()

    const chooseButton = page.getByRole('button', { name: /Choose/i }).first()
    await chooseButton.click()

    const buildTrigger = page.getByRole('button', { name: /Build \(/ })
    await buildTrigger.click()

    const drawerHeading = page.getByRole('heading', { name: 'Build list' })
    await expect(drawerHeading).toBeVisible()
    await expect(page.getByText('Rainshadow Eternity RX10 7\'11" ML')).toBeVisible()

    const closeButton = page.getByRole('button', { name: /Close/i })
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  })
})
