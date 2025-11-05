import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import 'dotenv/config'

const STORAGE_STATE = process.env.PW_STORAGE_STATE || 'tests/.auth/state.json'
const maybeStorageState = fs.existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined

// Ensure a local SQLite DB for e2e runs if none provided
const E2E_DB = process.env.DATABASE_URL || `file:${process.cwd()}/.tmp/e2e.sqlite`

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
    storageState: maybeStorageState,
  },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        // Provide minimal env so Remix server can boot locally for e2e
        // Use a local SQLite file DB and run a soft migrate if needed
        command: [
          `DATABASE_URL=${E2E_DB}`,
          'ALLOW_HQ_OVERRIDE=1',
          'SHOPIFY_APP_URL=http://127.0.0.1:3000',
          'SHOPIFY_API_KEY=dev',
          'SHOPIFY_API_SECRET=dev',
          'SCOPES=read_products',
          // Build, generate prisma client, and attempt a soft migrate (ignore failures)
          'npm run -s build',
          '&&',
          // Reset e2e sqlite db to ensure a clean schema
          `rm -f ${process.cwd()}/.tmp/e2e.sqlite || true`,
          '&&',
          `DATABASE_URL=${E2E_DB}`,
          'npm run -s setup:full || npm run -s setup',
          '&&',
          // For e2e on ephemeral SQLite, prefer db push over migrate
          `DATABASE_URL=${E2E_DB}`,
          'npx prisma db push --accept-data-loss',
          '&&',
          `DATABASE_URL=${E2E_DB}`,
          'ALLOW_HQ_OVERRIDE=1 SHOPIFY_APP_URL=http://127.0.0.1:3000 SHOPIFY_API_KEY=dev SHOPIFY_API_SECRET=dev SCOPES=read_products npm run -s start',
        ].join(' '),
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
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
