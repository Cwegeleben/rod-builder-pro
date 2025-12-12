#!/usr/bin/env tsx
import { PrismaClient, Prisma } from '@prisma/client'
import { normalizeBatsonProduct } from '../../app/services/suppliers/batsonNormalize.server'
import { applyBatsonProducts } from '../../app/services/suppliers/batsonApply.server'

const prisma = new PrismaClient()

const SUPPLIER_SLUG = process.env.SUPPLIER_SLUG || 'batson'
const SUPPLIER_SITE_ID = process.env.SUPPLIER_SITE_ID || SUPPLIER_SLUG
const APPLY_LIMIT = Number(process.env.APPLY_LIMIT || '0')
const TARGET_CATEGORY = (process.env.TARGET_CATEGORY || 'blank').toLowerCase()

async function main() {
  const supplier = await prisma.supplier.findUnique({ where: { slug: SUPPLIER_SLUG } })
  if (!supplier) {
    throw new Error(`Supplier ${SUPPLIER_SLUG} not found`)
  }
  const supplierKeys = Array.from(new Set([supplier.id, SUPPLIER_SLUG])).filter(Boolean)
  const rows = await prisma.partStaging.findMany({
    where: { supplierId: { in: supplierKeys } },
    orderBy: { fetchedAt: 'desc' },
  })
  if (!rows.length) {
    console.log(`[reapplyBatsonBlanks] No staging rows found for ${SUPPLIER_SLUG}`)
    return
  }
  const applyInputs: Parameters<typeof applyBatsonProducts>[0] = []
  for (const row of rows) {
    if (APPLY_LIMIT && applyInputs.length >= APPLY_LIMIT) break
    const images = (row.images as string[]) || []
    const normalized = normalizeBatsonProduct({
      externalId: row.externalId,
      partType: row.partType,
      title: row.title,
      description: row.description || '',
      rawSpecs: (row.rawSpecs as Record<string, unknown>) || {},
      availability: row.availability ?? null,
      priceMsrp: row.priceMsrp ? Number(row.priceMsrp) : null,
      images,
      imageUrl: images.length ? images[0] : null,
    })
    if (!normalized) continue
    const normalizedCategory = (normalized.category || '').toLowerCase()
    if (TARGET_CATEGORY && normalizedCategory !== TARGET_CATEGORY) continue
    const normalizedPayload = normalized ? (normalized as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
    await prisma.partStaging.update({ where: { id: row.id }, data: { normSpecs: normalizedPayload } })
    applyInputs.push({
      supplierId: supplier.id,
      supplierSiteId: SUPPLIER_SITE_ID,
      title: row.title,
      description: row.description ?? undefined,
      images: row.images as Prisma.InputJsonValue,
      normalized,
    })
  }
  if (!applyInputs.length) {
    console.log('[reapplyBatsonBlanks] No rows ready for apply in category %s', TARGET_CATEGORY)
    return
  }
  const result = await applyBatsonProducts(applyInputs, { mirror: false })
  console.log(
    '[reapplyBatsonBlanks] upserts=%d applied=%d category=%s',
    result.upserts,
    applyInputs.length,
    TARGET_CATEGORY,
  )
}

main()
  .catch(err => {
    console.error('[reapplyBatsonBlanks] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
