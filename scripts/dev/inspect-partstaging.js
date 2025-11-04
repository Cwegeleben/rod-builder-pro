// Inspect SQLite column types for PartStaging (ESM)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
try {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('PartStaging')`)
  console.log(rows)
} catch (e) {
  console.error('Error:', e)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
