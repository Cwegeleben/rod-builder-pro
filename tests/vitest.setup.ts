import { execSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Ensure Prisma client is generated before tests and a local SQLite DB is available
try {
  // Minimal env defaults for Shopify app boot during tests
  process.env.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || 'test-key'
  process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || 'test-secret'
  process.env.SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'http://localhost:3000'
  process.env.SCOPES = process.env.SCOPES || 'write_products,read_products'
  // Use a local SQLite file for unit tests that touch Prisma. Keep it in repo root so Prisma can resolve relative path.
  if (!process.env.DATABASE_URL) {
    const dbPath = resolve(process.cwd(), '.tmp', 'unit-tests.sqlite')
    const dbDir = dirname(dbPath)
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
    process.env.DATABASE_URL = `file:${dbPath}`
  }
  execSync('npx prisma generate', { stdio: 'inherit' })
  // Note: We do not apply migrations or push schema here to keep unit tests fast and isolated.
  // Tests that require DB access should mock Prisma or manage their own setup.
} catch (e) {
  console.error('[vitest.setup] Prisma setup failed')
  throw e
}
