// <!-- BEGIN RBP GENERATED: cleanup-empty-partstaging-v1 -->
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

/**
 * Deletes PartStaging rows where supplierId/externalId are null, empty, or whitespace-only.
 * Keeps everything else untouched. Idempotent & safe to run anytime pre-migrate.
 */
async function main() {
  // Use raw SQL to bypass Prisma client validation on non-nullable fields
  // Covers: NULLs and whitespace-only values
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM PartStaging
     WHERE supplierId IS NULL OR externalId IS NULL
        OR TRIM(supplierId) = '' OR TRIM(externalId) = ''`
  )
  console.log(`cleanup-empty-partstaging: removed ${deleted} invalid rows (null or empty/whitespace)`) 
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
// <!-- END RBP GENERATED: cleanup-empty-partstaging-v1 -->
