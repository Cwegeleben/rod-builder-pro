#!/usr/bin/env node
/**
 * Backfill publish.handle/webUrl for ImportDiff.validation where handle ended up as "rbp-<supplier>-undefined".
 *
 * Usage:
 *   RUN_ID=<runId> node scripts/migrate/backfill-publish-handles.mjs
 *   # or process all runs (use with care)
 *   node scripts/migrate/backfill-publish-handles.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}
function buildHandle(supplierId, externalId) {
  return `rbp-${slugify(supplierId)}-${slugify(externalId)}`
}
function mkProductUrl(shop, handle) {
  if (!shop || !handle) return null
  const domain = String(shop).replace(/^https?:\/\//, '')
  return `https://${domain}/products/${handle}`
}

async function main() {
  const RUN_ID = process.env.RUN_ID || ''
  // Find target diffs
  let diffs = []
  if (RUN_ID) {
    diffs = await prisma.importDiff.findMany({
      where: { importRunId: RUN_ID },
      select: { id: true, importRunId: true, externalId: true, validation: true, after: true },
    })
  } else {
    diffs = await prisma.importDiff.findMany({
      where: {},
      select: { id: true, importRunId: true, externalId: true, validation: true, after: true },
      take: 1000,
    })
  }
  if (!diffs.length) {
    console.log('No diffs found.')
    return
  }
  // Group runs to fetch supplier/shop context
  const runIds = Array.from(new Set(diffs.map(d => d.importRunId)))
  const runs = await prisma.importRun.findMany({ where: { id: { in: runIds } } })
  const runsById = new Map(runs.map(r => [r.id, r]))

  let updated = 0
  for (const d of diffs) {
    const val = (d.validation || {})
    const pub = (val && typeof val === 'object' ? val.publish : null) || null
    const currentHandle = pub && typeof pub.handle === 'string' ? pub.handle : ''
    if (!currentHandle) continue
    if (currentHandle !== 'rbp-batson-undefined' && !currentHandle.endsWith('-undefined')) continue
    const after = d.after || {}
    const externalId = String(after.externalId || d.externalId || '')
    if (!externalId) continue
    const run = runsById.get(d.importRunId)
    const supplierId = String((after.supplierId || run?.supplierId || 'batson'))
    const nextHandle = buildHandle(supplierId, externalId)

    // Best-effort shop
    const summary = (run?.summary || {})
    const publish = (summary && typeof summary === 'object' ? summary.publish : null) || null
    const shop = (publish && typeof publish === 'object' ? publish.shop : null) || process.env.SHOP || null
    const webUrl = mkProductUrl(shop || '', nextHandle)

    const nextValidation = {
      ...(val || {}),
      publish: {
        ...((val || {}).publish || {}),
        handle: nextHandle,
        webUrl,
      },
    }
    await prisma.importDiff.update({ where: { id: d.id }, data: { validation: nextValidation } })
    updated++
    console.log('updated', d.id, currentHandle, '->', nextHandle)
  }
  console.log('done', { updated, scanned: diffs.length })
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
