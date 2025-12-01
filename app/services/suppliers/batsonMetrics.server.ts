import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import { BATSON_SUPPLIER_SLUGS } from './batsonSync.server'

export type BatsonMetricsRow = {
  slug: string
  seedCount: number
  productCount: number
  designStudioReadyCount: number
  readyRatioPct: number | null
}

export type BatsonMetricsSnapshot = {
  generatedAt: string
  rows: BatsonMetricsRow[]
}

async function resolveSupplierIds(slug: string): Promise<string[]> {
  const ids = new Set<string>([slug])
  try {
    const row = await prisma.supplier.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
      select: { id: true },
    })
    if (row?.id) ids.add(row.id)
  } catch {
    /* ignore lookup failures */
  }
  return Array.from(ids)
}

async function countSeeds(supplierIds: string[]) {
  if (!supplierIds.length) return 0
  return prisma.productSource.count({ where: { supplierId: { in: supplierIds } } })
}

async function countProducts(slug: string, supplierIds: string[], readyOnly = false) {
  const orClause: Prisma.ProductWhereInput[] = [{ supplier: { slug } }]
  if (supplierIds.length) orClause.unshift({ supplierId: { in: supplierIds } })
  const where: Prisma.ProductWhereInput = {
    OR: orClause,
    ...(readyOnly ? { designStudioReady: true } : {}),
  }
  return prisma.product.count({ where })
}

export async function getBatsonMetricsSnapshot(): Promise<BatsonMetricsSnapshot> {
  const rows: BatsonMetricsRow[] = []
  for (const slug of BATSON_SUPPLIER_SLUGS) {
    const supplierIds = await resolveSupplierIds(slug)
    const [seedCount, productCount, designStudioReadyCount] = await Promise.all([
      countSeeds(supplierIds),
      countProducts(slug, supplierIds),
      countProducts(slug, supplierIds, true),
    ])
    const readyRatioPct = productCount > 0 ? (designStudioReadyCount / productCount) * 100 : null
    rows.push({ slug, seedCount, productCount, designStudioReadyCount, readyRatioPct })
  }
  return { generatedAt: new Date().toISOString(), rows }
}
