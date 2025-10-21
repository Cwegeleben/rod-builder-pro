import { execSync } from 'node:child_process'

// Ensure Prisma client is generated and DB is migrated before tests
try {
  execSync('npx prisma generate', { stdio: 'inherit' })
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[vitest.setup] Prisma setup failed')
  throw e
}
