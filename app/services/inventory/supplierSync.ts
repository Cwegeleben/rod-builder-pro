// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
import { prisma } from '../../db.server'
import { ensureAuthSession } from './playwrightAuth'
import { updateInventoryMetafields } from './shopifyUpdate'

interface SyncResultSummary {
  supplierDomain: string
  productsChecked: number
  changes: number
  status: 'ok' | 'auth_fail'
}

export async function runSupplierInventorySync(admin: any): Promise<SyncResultSummary[]> {
  const profiles = await prisma.supplierAuthProfile.findMany()
  const summaries: SyncResultSummary[] = []
  for (const p of profiles) {
    const auth = await ensureAuthSession(p.id)
    if (auth.status !== 'ok') {
      summaries.push({ supplierDomain: p.supplierDomain, productsChecked: 0, changes: 0, status: 'auth_fail' })
      continue
    }
    // Placeholder: fetch & parse supplier inventory page(s)
    const sampleInventory = [
      { productCode: 'SKU-1', qtyAvailable: 25, cost: 10.5 },
      { productCode: 'SKU-2', qtyAvailable: 0, cost: 7.0 },
    ]
    let changes = 0
    const now = new Date()
    for (const row of sampleInventory) {
      const existing = await prisma.supplierInventorySnapshot.findFirst({
        where: { supplierDomain: p.supplierDomain, productCode: row.productCode },
        orderBy: { createdAt: 'desc' },
      })
      const diff = !existing || existing.qtyAvailable !== row.qtyAvailable || existing.cost !== row.cost
      if (diff) changes += 1
      await prisma.supplierInventorySnapshot.create({
        data: {
          supplierDomain: p.supplierDomain,
          productCode: row.productCode,
          qtyAvailable: row.qtyAvailable,
          cost: row.cost,
          status: diff ? 'changed' : 'same',
          snapshotJson: row,
          lastSeenAt: now,
        },
      })
    }
    // Metafield update placeholder (requires mapping productCode->productId)
    const productUpdates: { productId: string; qty?: number | null; lastCheck: Date }[] = []
    await updateInventoryMetafields(admin, productUpdates)
    summaries.push({ supplierDomain: p.supplierDomain, productsChecked: sampleInventory.length, changes, status: 'ok' })
  }
  return summaries
}

export async function getInventoryStatusSummary() {
  const suppliers = await prisma.supplierAuthProfile.findMany()
  const result = [] as Array<{
    supplierDomain: string
    lastSync?: string
    products?: number
    changes?: number
    status: string
  }>
  for (const s of suppliers) {
    const lastSnapshot = await prisma.supplierInventorySnapshot.findFirst({
      where: { supplierDomain: s.supplierDomain },
      orderBy: { createdAt: 'desc' },
    })
    result.push({
      supplierDomain: s.supplierDomain,
      lastSync: lastSnapshot?.createdAt?.toISOString(),
      products: undefined,
      changes: undefined,
      status: lastSnapshot ? lastSnapshot.status : 'none',
    })
  }
  return result
}

export async function getCurrentInventoryBySupplier(domain: string) {
  return prisma.supplierInventorySnapshot.findMany({
    where: { supplierDomain: domain },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
