#!/usr/bin/env node
// Purge product_db canonical tables with an automatic JSON backup.
// Backup includes: Supplier (only those referenced), Product, ProductVersion, ProductSource.
// Usage: node scripts/migrate/clear-productdb.mjs [--no-backup] [--force]
//   --no-backup  Skip creating the backup file (not recommended)
//   --force      Proceed without interactive confirmation (CI / non-TTY)

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { PrismaClient } from '@prisma/client'
let prisma

function parseArgs() {
  const args = new Set(process.argv.slice(2))
  return { noBackup: args.has('--no-backup'), force: args.has('--force') }
}

async function main() {
  const { noBackup, force } = parseArgs()
  const isTTY = process.stdout.isTTY
  if (!force && isTTY) {
    const prompt = 'This will DELETE all Product / ProductVersion / ProductSource rows. Continue? (yes/no) '
    process.stdout.write(prompt)
    const answer = await new Promise(r => {
      process.stdin.resume()
      process.stdin.setEncoding('utf8')
      process.stdin.once('data', d => r(String(d).trim().toLowerCase()))
    })
    if (answer !== 'yes') {
      console.log('Aborted.')
      process.exit(1)
    }
  }

  // Ensure DATABASE_URL is present (fallback to local SQLite)
  if (!process.env.DATABASE_URL) {
    // Default to repo-local prisma/dev.sqlite
    process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
    console.log(`[env] DATABASE_URL not set; using ${process.env.DATABASE_URL}`)
  }

  // Initialize Prisma after env fallback
  prisma = new PrismaClient()

  let backupPath = null
  if (!noBackup) {
    // Only attempt backup if tables exist
    const tables = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table'`)
    const has = name => Array.isArray(tables) && tables.some(t => t.name === name)
    if (has('Product')) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const backupsDir = path.resolve(__dirname, '../../storage/backups')
      fs.mkdirSync(backupsDir, { recursive: true })
      backupPath = path.join(backupsDir, `productdb-backup-${ts}.json`)
      console.log('[backup] collecting rows...')
      const [products, versions, sources, suppliers] = await Promise.all([
        prisma.product.findMany({}),
        prisma.productVersion.findMany({}),
        prisma.productSource.findMany({}),
        prisma.supplier.findMany({}),
      ])
      const usedSupplierIds = new Set(products.map(p => p.supplierId).concat(sources.map(s => s.supplierId)))
      const supplierSubset = suppliers.filter(s => usedSupplierIds.has(s.id))
      const payload = { meta: { createdAt: new Date().toISOString(), productCount: products.length, versionCount: versions.length, sourceCount: sources.length, supplierCount: supplierSubset.length }, suppliers: supplierSubset, products, versions, sources }
      fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2))
      console.log(`[backup] wrote ${backupPath}`)
    } else {
      console.log('[backup] skipped (Product table not found)')
    }
  }

  console.log('[purge] deleting ProductSource → Product (cascade versions) ...')
  // Check table existence to avoid errors on fresh DBs
  const tables = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table'`)
  const has = name => Array.isArray(tables) && tables.some(t => t.name === name)
  let deletedSources = { count: 0 }
  let deletedProducts = { count: 0 }
  if (has('ProductSource')) {
    deletedSources = await prisma.productSource.deleteMany({})
  }
  if (has('Product')) {
    deletedProducts = await prisma.product.deleteMany({}) // cascades ProductVersion
  }
  console.log(`[purge] deleted sources=${deletedSources.count} products=${deletedProducts.count}`)

  console.log('[verify] counting remaining rows...')
  const [pLeft, vLeft, sLeft] = await Promise.all([
    has('Product') ? prisma.product.count() : Promise.resolve(0),
    has('ProductVersion') ? prisma.productVersion.count() : Promise.resolve(0),
    has('ProductSource') ? prisma.productSource.count() : Promise.resolve(0),
  ])
  console.log(`[verify] remaining products=${pLeft} versions=${vLeft} sources=${sLeft}`)
  if (pLeft || vLeft || sLeft) {
    console.warn('[warn] Some rows remain; manual intervention may be required.')
  }
  console.log('[done] product_db purge complete' + (backupPath ? ` (backup at ${backupPath})` : ''))
  await prisma.$disconnect()
}

main().catch(err => {
  console.error('[error] purge failed:', err)
  process.exit(1)
})
