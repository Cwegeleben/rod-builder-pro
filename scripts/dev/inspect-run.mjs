// Quick inspector for an import run's diffs/specs/publish diagnostics
// Use createRequire to import TS transpiled CommonJS file (relies on ts-node/tsx when run via node -r or executed through build tooling). Fallback to relative compiled JS if available.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let prisma
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  prisma = require('../../app/db.server').prisma
} catch (err) {
  console.error('Failed to load prisma from app/db.server:', err)
  process.exit(1)
}

const runId = process.argv[2]
if (!runId) {
  console.error('Usage: node scripts/dev/inspect-run.mjs <runId>')
  process.exit(1)
}

const asRec = (u) => (u && typeof u === 'object' ? u : {})

async function main() {
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  console.log('Run:', run ? { id: run.id, supplierId: run.supplierId, status: run.status } : 'NOT FOUND')
  const diffs = await prisma.importDiff.findMany({
    where: { importRunId: runId },
    select: { id: true, externalId: true, diffType: true, resolution: true, after: true, validation: true },
    orderBy: { id: 'asc' },
  })
  for (const d of diffs) {
    let publish = null
    try {
      const v = typeof d.validation === 'string' ? JSON.parse(d.validation) : d.validation || {}
      publish = asRec(v).publish || null
  } catch { /* ignore parse */ }
    const after = asRec(d.after)
    const rawSpecs = asRec(after.rawSpecs)
    const normSpecs = asRec(after.normSpecs)
    const noSpecs = Object.keys(rawSpecs).length === 0 && Object.keys(normSpecs).length === 0
    console.log(JSON.stringify({
      externalId: d.externalId,
      diffType: d.diffType,
      resolution: d.resolution,
      noSpecs,
      counts: { raw: Object.keys(rawSpecs).length, norm: Object.keys(normSpecs).length },
      publish,
    }, null, 2))
  }
}

main().finally(async () => { await prisma.$disconnect() })
