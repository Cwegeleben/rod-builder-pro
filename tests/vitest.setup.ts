import { execSync } from 'node:child_process'

// Ensure Prisma client is generated before tests
try {
  // Minimal env defaults for Shopify app boot during tests
  process.env.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || 'test-key'
  process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || 'test-secret'
  process.env.SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'http://localhost:3000'
  process.env.SCOPES = process.env.SCOPES || 'write_products,read_products'
  execSync('npx prisma generate', { stdio: 'inherit' })
} catch (e) {
  console.error('[vitest.setup] Prisma setup failed')
  throw e
}
