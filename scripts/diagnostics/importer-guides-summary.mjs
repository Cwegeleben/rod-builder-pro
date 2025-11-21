#!/usr/bin/env node
/**
 * Diagnostics: Batson importer seeds vs products summary
 * Usage:
 *   node scripts/diagnostics/importer-guides-summary.mjs --supplier <slug|id> [--json]
 * Optional flags:
 *   --filter <all|guides|tips>  Filter URLs/types when counting (default: all)
 *   --limit <n>                 Limit URLs shown in samples (default: 25)
 *   --json                      Emit machine-readable JSON output
 */
import process from 'process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
let prisma
try {
  prisma = require('../../app/db.server').prisma
} catch (e) {
  try {
    const { PrismaClient } = require('@prisma/client')
    prisma = new PrismaClient()
  } catch (e2) {
    console.error('[importer-guides-summary] Failed to load prisma:', e2?.message)
    process.exit(1)
  }
}

function parseArgs(argv) {
  const out = { supplier: null, filter: 'all', limit: 25, json: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--supplier' && argv[i + 1]) out.supplier = argv[++i]
    else if (a === '--filter' && argv[i + 1]) out.filter = (argv[++i] || 'all').toLowerCase()
    else if (a === '--limit' && argv[i + 1]) out.limit = parseInt(argv[++i], 10) || out.limit
    else if (a === '--json') out.json = true
  }
  if (!out.supplier) {
    console.error('Missing --supplier <slug|id>')
    process.exit(1)
  }
  return out
}

async function resolveSupplierId(supplier) {
  // Try by id
  let rows = await prisma.$queryRawUnsafe('SELECT id FROM Supplier WHERE id = ? LIMIT 1', supplier)
  if (rows && rows.length) return rows[0].id
  // Try by slug
  rows = await prisma.$queryRawUnsafe('SELECT id FROM Supplier WHERE slug = ? LIMIT 1', supplier)
  if (rows && rows.length) return rows[0].id
  // Fallback: create shallow supplier
  const id = supplier
  const slug = supplier.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
  await prisma.$executeRawUnsafe(
    'INSERT OR IGNORE INTO Supplier (id, slug, name, urlRoot, active, createdAt, updatedAt) VALUES (?, ?, ?, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    id, slug, supplier,
  )
  return id
}

function urlMatchesFilter(url, f) {
  const u = String(url || '').toLowerCase()
  if (f === 'all') return true
  if (f === 'guides') return /\/guides\//.test(u)
  if (f === 'tips') return /tip-top|tip-tops/.test(u)
  return true
}

async function main() {
  const opts = parseArgs(process.argv)
  const supplierId = await resolveSupplierId(opts.supplier)

  // ProductSource discovered URLs
  const sources = await prisma.$queryRawUnsafe(
    `SELECT url, externalId, source, lastSeenAt FROM ProductSource WHERE supplierId = ? ORDER BY lastSeenAt DESC`,
    supplierId,
  )
  const discovered = sources
    .filter(s => String(s.source || '') === 'discovered')
    .filter(s => urlMatchesFilter(s.url, opts.filter))

  // Products joined with latest version
  const products = await prisma.$queryRawUnsafe(
    `SELECT p.id, p.sku, p.title, p.type, p.latestVersionId, v.normSpecs
     FROM Product p LEFT JOIN ProductVersion v ON v.id = p.latestVersionId
     WHERE p.supplierId = ? ORDER BY p.updatedAt DESC`,
    supplierId,
  )

  // Build maps and counts
  const bySku = new Map()
  for (const p of products) {
    const key = String(p.sku || '')
    if (!bySku.has(key)) bySku.set(key, [])
    bySku.get(key).push(p)
  }
  const duplicates = Array.from(bySku.entries()).filter(([k, arr]) => k && arr.length > 1).map(([k, arr]) => ({ sku: k, count: arr.length }))

  const ingested = products.filter(p => {
    if (!p.latestVersionId) return false
    if (opts.filter === 'guides') return p.type === 'Guide' || /"classification"\s*:\s*"guide"/.test(String(p.normSpecs || ''))
    if (opts.filter === 'tips') return p.type === 'Tip Top' || /"classification"\s*:\s*"tip-top"/.test(String(p.normSpecs || ''))
    return true
  })

  const classify = (p) => {
    try {
      const ns = typeof p.normSpecs === 'string' ? JSON.parse(p.normSpecs) : p.normSpecs
      return ns?.classification || (p.type === 'Tip Top' ? 'tip-top' : p.type === 'Guide' ? 'guide' : undefined)
    } catch {
      return undefined
    }
  }
  const counts = {
    products: products.length,
    ingested: ingested.length,
    discovered: discovered.length,
    seedMatches: 0,
    missingSeeds: 0,
    productsWithoutSeed: 0,
  }
  const bucket = {}
  for (const p of ingested) {
    const c = classify(p) || 'other'
    bucket[c] = (bucket[c] || 0) + 1
  }

  const seedMatchSamples = []
  const seedMissingSamples = []
  const skuToProduct = new Map(products.map(p => [String(p.sku || '').trim().toUpperCase(), p]))
  const seedExtSet = new Set(discovered.map(s => String(s.externalId || '').trim().toUpperCase()).filter(Boolean))
  for (const s of discovered) {
    const ext = String(s.externalId || '').trim().toUpperCase()
    if (ext && skuToProduct.has(ext)) {
      counts.seedMatches++
      if (seedMatchSamples.length < opts.limit) seedMatchSamples.push({ url: s.url, externalId: ext })
    } else {
      counts.missingSeeds++
      if (seedMissingSamples.length < opts.limit)
        seedMissingSamples.push({ url: s.url, externalId: ext || null })
    }
  }

  const productsWithoutSeed = products.filter(p => {
    const sku = String(p.sku || '').trim().toUpperCase()
    return sku && !seedExtSet.has(sku)
  })
  counts.productsWithoutSeed = productsWithoutSeed.length
  const productMissingSamples = productsWithoutSeed.slice(0, opts.limit).map(p => ({ sku: p.sku, title: p.title }))

  const report = {
    ok: true,
    supplierId,
    filter: opts.filter,
    counts,
    byClassification: bucket,
    duplicates: { count: duplicates.length, sample: duplicates.slice(0, 10) },
    samples: {
      matchedSeeds: seedMatchSamples,
      missingSeeds: seedMissingSamples,
      productsWithoutSeed: productMissingSamples,
    },
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('=== Importer Seeds Summary ===')
    console.log('supplierId:', supplierId)
    console.log('filter:', opts.filter)
    console.log('counts:', counts)
    console.log('byClassification:', bucket)
    console.log('duplicates:', report.duplicates)
    console.log('seed matches:', counts.seedMatches, 'missing seeds:', counts.missingSeeds)
    console.log('products without seed:', counts.productsWithoutSeed)
    if (report.samples.missingSeeds.length) {
      console.log('\nMissing seed examples:')
      for (const s of report.samples.missingSeeds) console.log('-', s.url)
    }
    if (report.samples.productsWithoutSeed.length) {
      console.log('\nProducts without seed examples:')
      for (const s of report.samples.productsWithoutSeed) console.log('-', s.sku)
    }
    console.log('\nUse --json for machine-readable output.')
  }

  await prisma.$disconnect().catch(() => {})
}

main().catch(e => {
  console.error('[importer-guides-summary] Fatal error:', e)
  process.exit(1)
})
