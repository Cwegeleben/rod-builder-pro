import { PrismaClient } from '@prisma/client'

const table = process.argv[2]
if (!table) {
  console.error('Usage: node scripts/dev/inspect-table.mjs <TableName>')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('${table}')`)
  console.log(rows)
} catch (e) {
  console.error('Error:', e)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
