import { prisma } from '../../app/db.server'
import { getBatsonMetricsSnapshot } from '../../app/services/suppliers/batsonMetrics.server'

async function main() {
  const snapshot = await getBatsonMetricsSnapshot()
  console.table(
    snapshot.rows.map(row => ({
      slug: row.slug,
      seeds: row.seedCount,
      products: row.productCount,
      dsReady: row.designStudioReadyCount,
      readyPct: row.readyRatioPct == null ? 'n/a' : `${row.readyRatioPct.toFixed(1)}%`,
    })),
  )
  console.log(JSON.stringify(snapshot, null, 2))
  await prisma.$disconnect()
}

main().catch(error => {
  console.error('[batsonSyncReport] failed', error)
  void prisma.$disconnect()
  process.exit(1)
})
