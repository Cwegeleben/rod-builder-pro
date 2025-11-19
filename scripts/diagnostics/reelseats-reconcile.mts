#!/usr/bin/env tsx
/**
 * Reel Seats reconciliation diagnostic.
 * Explains why discovered Batson reel seat URLs (~N) consolidate into far fewer canonical products.
 * Output JSON: {
 *   supplierSlug,
 *   sourceTotals: { total, withProductId, withoutProductId },
 *   skuGrouping: { sku: { countSources, productId, title } },
 *   sampleUnlinked: string[]
 * }
 */
import { prisma } from '../../app/db.server'

async function main() {
  const supplierSlug = 'batson-reel-seats'
  // Resolve supplierId
  const supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
  if (!supplier) {
    console.error(JSON.stringify({ error: 'supplier-missing', supplierSlug }))
    process.exit(1)
  }
  const supplierId = supplier.id
  // Fetch sources
  const sources = await prisma.productSource.findMany({ where: { supplierId } })
  const total = sources.length
  const withProductId = sources.filter(s => !!s.productId).length
  const withoutProductId = total - withProductId

  // Fetch products for supplier to map sku -> product
  const products = await prisma.product.findMany({ where: { supplierId } })
  const byId = new Map(products.map(p => [p.id, p]))

  // Group sources by resolved product (sku) via productId pointer
  const skuGrouping: Record<string, { countSources: number; productId: string; title: string }> = {}
  for (const s of sources) {
    if (!s.productId) continue
    const p = byId.get(s.productId)
    if (!p) continue
    if (!skuGrouping[p.sku]) skuGrouping[p.sku] = { countSources: 0, productId: p.id, title: p.title }
    skuGrouping[p.sku].countSources++
  }

  const sampleUnlinked = sources.filter(s => !s.productId).slice(0, 20).map(s => s.url)

  const result = {
    supplierSlug,
    sourceTotals: { total, withProductId, withoutProductId },
    productsTotal: products.length,
    skuGrouping,
    sampleUnlinked,
  }
  console.log(JSON.stringify(result, null, 2))
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }))
  process.exit(1)
})
