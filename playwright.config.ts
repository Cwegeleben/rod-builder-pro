import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Keep baseURL unset by default; tests may use PW_BASE_URL or relative paths.
    trace: 'on-first-retry',
  },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command:
          'SHOPIFY_APP_URL=http://127.0.0.1:3000 SHOPIFY_API_KEY=dev SHOPIFY_API_SECRET=dev SCOPES=read_products npm run -s build && SHOPIFY_APP_URL=http://127.0.0.1:3000 SHOPIFY_API_KEY=dev SHOPIFY_API_SECRET=dev SCOPES=read_products npm run -s start',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
})
