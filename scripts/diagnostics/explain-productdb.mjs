#!/usr/bin/env node
/**
 * Diagnostics: EXPLAIN QUERY PLAN for common canonical product_db queries.
 * Usage:
 *   node scripts/diagnostics/explain-productdb.mjs [--json]
 * Optional flags:
 *   --supplier <id>   Limit product list queries to a supplierId
 *   --limit <n>       Limit row counts for sampling queries (default 25)
 *   --json            Emit machine-readable JSON output
 *
 * Provides guidance on whether additional indexes are needed. It prints each
 * query, the SQLite EXPLAIN QUERY PLAN result, and heuristic advice.
 */
// Note: keep dependencies minimal to run in CI/containers
import process from 'process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Lazy load Prisma to avoid heavy startup if not installed
let prisma
try {
  prisma = require('../../app/db.server').prisma
} catch (e) {
  console.error('[explain-productdb] Failed to load prisma:', e?.message)
  process.exit(1)
}

function parseArgs(argv) {
  const out = { supplier: null, limit: 25, json: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--supplier' && argv[i + 1]) out.supplier = argv[++i]
    else if (a === '--limit' && argv[i + 1]) out.limit = parseInt(argv[++i], 10) || out.limit
    else if (a === '--json') out.json = true
  }
  return out
}

const opts = parseArgs(process.argv)

async function explain(sql, params = []) {
  // SQLite specific: EXPLAIN QUERY PLAN <statement>
  try {
    const planRows = await prisma.$queryRawUnsafe(
      `EXPLAIN QUERY PLAN ${sql}`,
      ...params,
    )
    return planRows
  } catch (e) {
    return [{ detail: 'ERROR', error: e?.message || String(e) }]
  }
}

function classifyPlan(rows) {
  // Rows look like: { selectid: 0, order: 0, from: 0, detail: 'SCAN TABLE Product' }
  const details = rows.map(r => r.detail || '').join(' | ')
  const advice = []
  if (/SCAN TABLE Product\b/.test(details) && /USING INDEX/.test(details) === false) {
    advice.push('Consider index on Product(status, supplierId, updatedAt DESC) if filtering by supplier/status.')
  }
  if (/SCAN TABLE ProductVersion\b/.test(details)) {
    advice.push('If frequent lookups by productId, ensure ProductVersion has index on productId (should exist).')
  }
  if (/SEARCH TABLE Product USING INTEGER PRIMARY KEY/.test(details)) {
    advice.push('Primary key lookup optimal.')
  }
  if (advice.length === 0) advice.push('No obvious index gaps detected.')
  return advice
}

async function main() {
  const report = []
  const supplierFilter = opts.supplier ? 'WHERE supplierId = ?' : ''
  const params = opts.supplier ? [opts.supplier] : []
  // Query 1: list products (canonical index page analog)
  const q1 = `SELECT id, supplierId, status, latestVersionId, updatedAt FROM Product ${supplierFilter} ORDER BY updatedAt DESC LIMIT ${opts.limit}`
  const p1 = await explain(q1, params)
  report.push({ name: 'products_list', sql: q1, plan: p1, advice: classifyPlan(p1) })
  // Query 2: versions for one product (history)
  const sampleProductRow = await prisma.$queryRawUnsafe(
    `SELECT id FROM Product ${supplierFilter} ORDER BY updatedAt DESC LIMIT 1`,
    ...params,
  )
  const productId = sampleProductRow?.[0]?.id
  if (productId) {
    const q2 = 'SELECT id, productId, contentHash, fetchedAt FROM ProductVersion WHERE productId = ? ORDER BY fetchedAt DESC LIMIT ?'
    const p2 = await explain(q2.replace('?', '?'), [productId, opts.limit])
    report.push({ name: 'product_versions', sql: q2, params: [productId, opts.limit], plan: p2, advice: classifyPlan(p2) })
  } else {
    report.push({ name: 'product_versions', skipped: true, reason: 'No product rows found for sampling.' })
  }
  // Query 3: join latest version content (publish path analog)
  const q3 = `SELECT p.id, v.contentHash FROM Product p JOIN ProductVersion v ON v.id = p.latestVersionId ${supplierFilter} ORDER BY p.updatedAt DESC LIMIT ${opts.limit}`
  const p3 = await explain(q3, params)
  report.push({ name: 'products_with_latest_version', sql: q3, plan: p3, advice: classifyPlan(p3) })

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, report }, null, 2))
  } else {
    console.log('=== product_db EXPLAIN diagnostics ===')
    for (const r of report) {
      console.log(`\n# ${r.name}`)
      if (r.skipped) {
        console.log('skipped:', r.reason)
        continue
      }
      console.log(r.sql)
      if (r.params) console.log('params:', JSON.stringify(r.params))
      console.table(r.plan)
      console.log('advice:')
      for (const a of r.advice) console.log(' -', a)
    }
    console.log('\nCompleted. Use --json for machine output.')
  }
  await prisma.$disconnect().catch(() => {})
}

main().catch(e => {
  console.error('[explain-productdb] Fatal error:', e)
  process.exit(1)
})
