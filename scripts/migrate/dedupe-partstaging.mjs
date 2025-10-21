// <!-- BEGIN RBP GENERATED: partstaging-dedupe-v1 -->
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT supplierId, externalId, COUNT(*) as c FROM PartStaging GROUP BY supplierId, externalId HAVING c > 1`
  )
  for (const r of rows) {
    const dups = await prisma.partStaging.findMany({
      where: { supplierId: r.supplierId, externalId: r.externalId },
      orderBy: { fetchedAt: 'desc' },
    })
    // keep first (latest), delete the rest
    const toDelete = dups.slice(1)
    if (toDelete.length) {
      await prisma.partStaging.deleteMany({ where: { id: { in: toDelete.map(x => x.id) } } })
      console.log(`Deduped ${r.supplierId}/${r.externalId}: removed ${toDelete.length}`)
    }
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
// <!-- END RBP GENERATED: partstaging-dedupe-v1 -->
