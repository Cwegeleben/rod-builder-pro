#!/usr/bin/env node
import { prisma } from '../../app/db.server.js'

async function main() {
  const runId = process.argv[2] || ''
  if (!runId) {
    console.error('Usage: print-run-stats <runId>')
    process.exit(1)
  }
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) {
    console.error('Run not found:', runId)
    process.exit(1)
  }
  const [adds, changes, dels, conflicts, total] = await Promise.all([
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'add' } }),
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'change' } }),
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'delete' } }),
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'conflict' } }),
    prisma.importDiff.count({ where: { importRunId: runId } }),
  ])
  console.log(JSON.stringify({
    ok: true,
    runId,
    status: run.status,
    supplierId: run.supplierId,
    counts: { add: adds, change: changes, delete: dels, conflict: conflicts, all: total },
    summary: run.summary || null,
  }, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
