#!/usr/bin/env node
// Delete all ImportTemplate rows and related artifacts.
import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    const path = await import('node:path')
    process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
    console.log(`[env] DATABASE_URL not set; using ${process.env.DATABASE_URL}`)
  }
  const prisma = new PrismaClient()
  const templates = await prisma.importTemplate.findMany({ select: { id: true } })
  if (!templates.length) {
    console.log('No import templates found.')
    return
  }
  const ids = templates.map(t => t.id)
  console.log(`Deleting ${ids.length} import template(s)...`)
  // Reuse delete logic endpoints emulate: compute supplierIds
  const rows = await prisma.importTemplate.findMany({ where: { id: { in: ids } }, select: { id: true, importConfig: true } })
  const { getTargetById } = await import('../../app/server/importer/sites/targets.js')
  const supplierIds = new Set()
  for (const r of rows) {
    try {
      const cfg = r.importConfig || {}
      const settings = cfg.settings || {}
      const targetId = typeof settings.target === 'string' ? settings.target : ''
      if (targetId) {
        const t = getTargetById(targetId)
        const sid = (t?.siteId) || targetId
        if (sid) supplierIds.add(sid)
      }
    } catch {
      // ignore malformed config
    }
  }
  const supplierArray = Array.from(supplierIds)
  if (supplierArray.length) {
    await prisma.partStaging.deleteMany({ where: { supplierId: { in: supplierArray } } })
    await prisma.productSource.deleteMany({ where: { supplierId: { in: supplierArray } } })
    const runs = await prisma.importRun.findMany({ where: { supplierId: { in: supplierArray } }, select: { id: true } })
    const runIds = runs.map(r => r.id)
    if (runIds.length) {
      await prisma.importDiff.deleteMany({ where: { importRunId: { in: runIds } } })
      await prisma.importRun.deleteMany({ where: { id: { in: runIds } } })
    }
  }
  await prisma.importTemplate.deleteMany({ where: { id: { in: ids } } })
  console.log('Deleted imports:', ids.length)
}
main().catch(e => { console.error(e); process.exit(1) })
