// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
import { prisma } from '../../app/db.server'
import { runSupplierInventorySync } from '../../app/services/inventory/supplierSync'

async function main() {
  // Acquire admin client from global context injection or instantiate (placeholder)
  const admin = (global as any).shopifyAdmin
  if (!admin) {
    console.error('[supplier-sync] Missing admin client; aborting')
    process.exit(1)
  }
  const summaries = await runSupplierInventorySync(admin)
  console.log('[supplier-sync] Completed', JSON.stringify(summaries))
  await prisma.$disconnect()
}
main().catch(e => {
  console.error('[supplier-sync] Error', e)
  process.exit(1)
})
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
