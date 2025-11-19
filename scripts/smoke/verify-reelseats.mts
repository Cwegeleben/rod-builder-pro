#!/usr/bin/env -S tsx
/**
 * Verify reel seat title normalization via the simple pipeline and Product DB writes.
 *
 * Env vars:
 * - URLS: Comma- or newline-separated list of Batson product/detail URLs (default: Alps Dual Trigger black/silver)
 * - OVERRIDE_SERIES: Optional series label to force (e.g., "AIP Contour")
 */
import { startImportFromOptions } from '../../app/services/importer/runOptions.server'
import path from 'node:path'

function parseUrls(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean)
}

async function main() {
  // Default to two Alps Dual Trigger product pages (Black and Silver)
  const defaultUrls = [
    'https://batsonenterprises.com/reel-seats/alps-aluminum-dual-trigger-black-alps-aluminum-dual-trigger-black',
    'https://batsonenterprises.com/reel-seats/alps-aluminum-dual-trigger-silver-alps-aluminum-dual-trigger-silver',
  ]
  const URLS = parseUrls(process.env.URLS)
  const manualUrls = URLS.length ? URLS : defaultUrls
  const overrideSeries = (process.env.OVERRIDE_SERIES || '').trim() || undefined

  // Ensure Product DB writes are enabled for this verification
  process.env.PRODUCT_DB_ENABLED = '1'
  // Ensure DATABASE_URL points to a local SQLite file if not provided
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
    console.log('[verify-reelseats] using local DB at', process.env.DATABASE_URL)
  }
  const { prisma } = await import('../../app/db.server')

  // Minimal bootstrap of required tables when running standalone (SQLite)
  try {
    const stmts = [
      'PRAGMA foreign_keys=OFF;',
      'CREATE TABLE IF NOT EXISTS "Supplier" ("id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "urlRoot" TEXT, "active" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  'CREATE TABLE IF NOT EXISTS "Product" ("id" TEXT NOT NULL PRIMARY KEY, "supplierId" TEXT NOT NULL, "sku" TEXT NOT NULL, "title" TEXT NOT NULL, "type" TEXT, "status" TEXT NOT NULL DEFAULT "DRAFT", "latestVersionId" TEXT, "publishHandle" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE);',
      'CREATE UNIQUE INDEX IF NOT EXISTS "product_supplier_sku_unique" ON "Product"("supplierId","sku");',
      'CREATE INDEX IF NOT EXISTS "Product_supplierId_idx" ON "Product"("supplierId");',
      'CREATE TABLE IF NOT EXISTS "ProductVersion" ("id" TEXT NOT NULL PRIMARY KEY, "productId" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "rawSpecs" TEXT, "normSpecs" TEXT, "description" TEXT, "images" TEXT, "priceMsrp" DECIMAL, "priceWholesale" DECIMAL, "availability" TEXT, "sourceSnapshot" TEXT, "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);',
      'CREATE UNIQUE INDEX IF NOT EXISTS "product_version_hash_unique" ON "ProductVersion"("productId","contentHash");',
      'CREATE INDEX IF NOT EXISTS "ProductVersion_productId_idx" ON "ProductVersion"("productId");',
      'CREATE TABLE IF NOT EXISTS "ProductSource" ("id" TEXT NOT NULL PRIMARY KEY, "supplierId" TEXT NOT NULL, "templateId" TEXT, "url" TEXT NOT NULL, "externalId" TEXT, "source" TEXT NOT NULL, "notes" TEXT, "productId" TEXT, "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductSource_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "ProductSource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE);',
      'CREATE UNIQUE INDEX IF NOT EXISTS "product_source_supplier_template_url_unique" ON "ProductSource"("supplierId","templateId","url");',
      'CREATE TABLE IF NOT EXISTS "ImportRun" ("id" TEXT NOT NULL PRIMARY KEY, "supplierId" TEXT NOT NULL, "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" DATETIME, "status" TEXT NOT NULL, "progress" TEXT, "summary" TEXT);',
      'PRAGMA foreign_keys=ON;'
    ]
    for (const sql of stmts) {
      try { await prisma.$executeRawUnsafe(sql) } catch { /* ignore */ }
    }
  } catch {
    // best-effort; ignore if migrations already set things up
  }

  console.log('[verify-reelseats] preparing simple run…', { count: manualUrls.length, overrideSeries })
  // Pre-create an ImportRun to bypass JSON limitations in some environments
  const runId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  await prisma.$executeRawUnsafe(
    'INSERT INTO ImportRun (id, supplierId, status) VALUES (?, ?, ?)',
    runId,
    'batson-reel-seats',
    'preparing',
  )
  await startImportFromOptions(
    {
      mode: 'discover',
      includeSeeds: true,
      manualUrls,
      skipSuccessful: false,
      notes: 'prepare:verify-reelseats',
      // Supplier is determined from URL path; leave undefined
      templateKey: undefined,
      variantTemplateId: undefined,
      scraperId: undefined,
      useSeriesParser: false,
      includeSeedsOnly: true,
      limit: manualUrls.length,
      pipeline: 'simple',
      overrideSeries,
    },
    runId,
  )
  console.log('[verify-reelseats] run staged', { runId })

  // Look up Product rows linked to the provided URLs via ProductSource
  const placeholders = manualUrls.map(() => '?').join(',')
  const supplierSlug = 'batson-reel-seats'
  const supRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    'SELECT id FROM Supplier WHERE slug = ? LIMIT 1',
    supplierSlug,
  )
  if (!supRows.length) {
    console.error('[verify-reelseats] supplier not found:', supplierSlug)
    process.exit(2)
  }
  const supplierId = supRows[0].id
  const sources = await prisma.$queryRawUnsafe<Array<{ productId: string | null; url: string }>>(
    `SELECT productId, url FROM ProductSource WHERE supplierId = ? AND url IN (${placeholders})`,
    supplierId,
    ...manualUrls,
  )
  const productIds = Array.from(new Set(sources.map(s => s.productId).filter(Boolean))) as string[]
  if (!productIds.length) {
    console.warn('[verify-reelseats] no Product links found for provided URLs')
  }
  const rows = productIds.length
    ? await prisma.$queryRawUnsafe<Array<{ sku: string; title: string }>>(
        `SELECT sku, title FROM Product WHERE id IN (${productIds.map(() => '?').join(',')})`,
        ...productIds,
      )
    : []
  console.log('[verify-reelseats] titles:')
  for (const r of rows) console.log(`- ${r.sku}: ${r.title}`)
}

main().catch(err => {
  console.error('[verify-reelseats] error', err)
  process.exit(1)
})
