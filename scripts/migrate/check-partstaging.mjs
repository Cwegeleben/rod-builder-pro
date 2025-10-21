// <!-- BEGIN RBP GENERATED: partstaging-check-v1 -->
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const dupes = await prisma.$queryRawUnsafe(
    `SELECT supplierId, externalId, COUNT(*) as c FROM PartStaging GROUP BY supplierId, externalId HAVING c > 1`
  )
  console.log('Duplicates:', dupes)

  const bad = await prisma.$queryRawUnsafe(
    `SELECT id, supplierId, externalId FROM PartStaging WHERE supplierId IS NULL OR externalId IS NULL OR TRIM(externalId) = ''`
  )
  console.log('Null/empty keys:', bad)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => prisma.$disconnect())
// <!-- END RBP GENERATED: partstaging-check-v1 -->
