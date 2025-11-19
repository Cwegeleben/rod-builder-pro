#!/usr/bin/env node
// ESM import with explicit .js extension since package type is module and built sources not transpiled
// Use require to load compiled CommonJS fallback via ts-node/tsx when run with node - ensure tsx use if needed
// Fallback: connect Prisma directly (new instance) if app db.server cannot be loaded via require path.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const supplierLike = process.env.SUPPLIER_LIKE || '%batson%'
  const limit = Math.max(1, Math.min(500, Number(process.env.LIMIT || '50')))
  const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM ProductSource WHERE supplierId LIKE ?`, supplierLike)
  console.log('count', countRows)

  // Distinct supplierIds present for matching domain (helps choose SUPPLIER_ID for ingestion)
  const distinctSuppliers = await prisma.$queryRawUnsafe(
    `SELECT supplierId, COUNT(*) as cnt
     FROM ProductSource
     WHERE supplierId LIKE ?
     GROUP BY supplierId
     ORDER BY cnt DESC`
    , supplierLike
  )
  console.log('distinctSupplierIds', distinctSuppliers)

  // Domain + detail-path focused view (reel-seats) regardless of supplierId pattern
  const detailLimit = Math.max(1, Math.min(1000, Number(process.env.DETAIL_LIMIT || '120')))
  const detailRows = await prisma.$queryRawUnsafe(
    `SELECT supplierId, url, externalId, source, lastSeenAt
     FROM ProductSource
     WHERE url LIKE '%batsonenterprises.com/reel-seats/%'
     ORDER BY lastSeenAt DESC
     LIMIT ?`, detailLimit
  )
  console.log('detailSample', detailRows.slice(0, 25))
  console.log('detailCount', detailRows.length)

  const sample = await prisma.$queryRawUnsafe(`SELECT url, externalId, source, lastSeenAt FROM ProductSource WHERE supplierId LIKE ? ORDER BY lastSeenAt DESC LIMIT ?`, supplierLike, limit)
  console.log('sample', sample)
}
main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
    } catch {
      // ignore
    }
  })
