// <!-- BEGIN RBP GENERATED: importer-price-diff-v1 -->
import { prisma } from '../db'
import { runPriceAvailabilityRefresh } from './priceAvail'

/**
 * Simple scheduler hook: looks up enabled ImportSchedule rows for profile 'price_avail'
 * and triggers the price/availability refresh job for each supplier.
 * Intended to be called by an external cron runner.
 */
export async function runScheduledPriceAvail() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const rows: Array<{ supplierId: string; enabled: boolean }> = await db.importSchedule.findMany({
    where: { profile: 'price_avail', enabled: true },
    select: { supplierId: true, enabled: true },
  })
  for (const r of rows) {
    await runPriceAvailabilityRefresh(r.supplierId)
  }
}
// <!-- END RBP GENERATED: importer-price-diff-v1 -->
