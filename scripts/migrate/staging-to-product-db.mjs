#!/usr/bin/env node
// One-time idempotent migration: copy PartStaging rows into canonical product_db tables.
// Safe to re-run: checks existing products/versions by unique identifiers.
// Usage: node scripts/migrate/staging-to-product-db.mjs [--limit N]

import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()

function hashContent(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex')
}

async function main() {
  const args = process.argv.slice(2)
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0
  const useLimit = Number.isFinite(limit) && limit > 0

  // Guard: abort if Product table already has rows (assume migration done)
  const existingProducts = await prisma.$queryRawUnsafe(
    'SELECT COUNT(1) as c FROM Product'
  )
  const count = Array.isArray(existingProducts) ? existingProducts[0]?.c || 0 : 0
  if (count > 0) {
    console.log('[migration] Product table not empty; aborting (idempotent guard).')
    return
  }

  // Fetch staging rows
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, supplierId, externalId, title, partType, description, images, rawSpecs, normSpecs,
            priceMsrp, priceWh, hashContent, fetchedAt, publishStatus, shopifyProductId
       FROM PartStaging
       ORDER BY fetchedAt ASC ${useLimit ? 'LIMIT ?' : ''}`,
    ...(useLimit ? [limit] : [])
  )
  console.log(`[migration] staging rows fetched: ${rows.length}`)

  let newSuppliers = 0
  let newProducts = 0
  let newVersions = 0
  let skippedVersions = 0

  for (const r of rows) {
    // Upsert Supplier by slug = supplierId (legacy mapping)
    const slug = r.supplierId
    const supplier = await prisma.supplier.upsert({
      where: { slug },
      update: {},
      create: { slug, name: slug, urlRoot: null },
    })
    if (supplier.createdAt.getTime() === supplier.updatedAt.getTime()) newSuppliers += 1

    // Upsert Product
    const product = await prisma.product.upsert({
      where: { supplierId_sku: { supplierId: supplier.id, sku: r.externalId } },
      update: {},
      create: {
        supplierId: supplier.id,
        sku: r.externalId,
        title: r.title,
        type: r.partType || null,
        status: 'DRAFT',
      },
    })
    if (product.createdAt.getTime() === product.updatedAt.getTime()) newProducts += 1

    const contentHash = r.hashContent || hashContent(JSON.stringify({ rawSpecs: r.rawSpecs, normSpecs: r.normSpecs }))

    // Check if version exists
    const existingVersion = await prisma.productVersion.findFirst({
      where: { productId: product.id, contentHash },
    })
    if (existingVersion) {
      skippedVersions += 1
      continue
    }
    const version = await prisma.productVersion.create({
      data: {
        productId: product.id,
        contentHash,
        rawSpecs: r.rawSpecs ?? null,
        normSpecs: r.normSpecs ?? null,
        description: r.description || null,
        images: r.images ?? null,
        priceMsrp: r.priceMsrp ?? null,
        priceWholesale: r.priceWh ?? null,
        fetchedAt: r.fetchedAt || new Date(),
        availability: null,
        sourceSnapshot: null,
      },
    })
    newVersions += 1

    // Update latestVersion pointer
    await prisma.product.update({
      where: { id: product.id },
      data: { latestVersionId: version.id },
    })

    // Infer status
    let status = 'DRAFT'
    if (r.publishStatus === 'created' || r.publishStatus === 'updated') status = 'PUBLISHED'
  else if (r.normSpecs && typeof r.normSpecs === 'object' && Object.keys(r.normSpecs).length > 0) status = 'READY'
    await prisma.product.update({ where: { id: product.id }, data: { status } })

    // If published previously, store handle if shopifyProductId present (heuristic)
    if (status === 'PUBLISHED' && r.shopifyProductId) {
      await prisma.$executeRawUnsafe('UPDATE Product SET publishHandle = ? WHERE id = ?', r.shopifyProductId, product.id)
    }
  }

  console.log(
    JSON.stringify({
      telemetry: 'migration',
      newSuppliers,
      newProducts,
      newVersions,
      skippedVersions,
    })
  )
}

main().catch(e => {
  console.error('[migration] failed', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
