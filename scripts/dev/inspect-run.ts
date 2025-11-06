/* Inspect an import run's diffs and publish diagnostics */
import { prisma } from '../../app/db.server'

function safeParse(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return {}
    }
  }
  return v || {}
}

async function main() {
  const runId = process.argv[2]
  if (!runId) {
    console.error('Usage: npx tsx scripts/dev/inspect-run.ts <runId>')
    process.exit(1)
  }
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  console.log('Run:', run ? { id: run.id, supplierId: run.supplierId, status: run.status } : 'NOT FOUND')
  const diffs = await prisma.importDiff.findMany({
    where: { importRunId: runId },
    select: { id: true, externalId: true, diffType: true, resolution: true, after: true, validation: true },
    orderBy: { id: 'asc' },
  })
  for (const d of diffs) {
    const after: any = safeParse(d.after)
    const rawSpecs: Record<string, unknown> = (after?.rawSpecs as any) || {}
    const normSpecs: Record<string, unknown> = (after?.normSpecs as any) || {}
    const val = safeParse(d.validation)
    const publish = (val as any)?.publish || null
    const noSpecs = Object.keys(rawSpecs).length === 0 && Object.keys(normSpecs).length === 0
    console.log(
      JSON.stringify(
        {
          externalId: d.externalId,
          diffType: d.diffType,
          resolution: d.resolution,
          noSpecs,
          specCounts: { raw: Object.keys(rawSpecs).length, norm: Object.keys(normSpecs).length },
          publish,
        },
        null,
        2,
      ),
    )
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
