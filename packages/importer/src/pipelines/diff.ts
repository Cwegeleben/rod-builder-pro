// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
import { prisma } from '../../../../app/db.server'

export async function diffStagingToCanonical(supplierId: string) {
  const staging = await prisma.partStaging.findMany({ where: { supplierId } })
  // If canonical Part table doesn't exist yet, treat as empty.
  const partsTableExists = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Part'`,
  )
  const existing = partsTableExists.length
    ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM Part WHERE supplierId = ?`, supplierId)
    : []
  const existingByExt = new Map(existing.map(p => [p.externalId, p]))

  const diffs: { externalId: string; type: 'add' | 'change' | 'delete'; before: any; after: any }[] = []

  for (const s of staging) {
    const before = existingByExt.get(s.externalId) || null
    if (!before) {
      diffs.push({ externalId: s.externalId, type: 'add', before: null, after: s })
    } else {
      const prevHash =
        before.hashContent || JSON.stringify([before.title, before.partType, before.specs || {}, before.images || []])
      const nextHash = s.hashContent
      if (nextHash !== prevHash) {
        diffs.push({ externalId: s.externalId, type: 'change', before, after: s })
      }
    }
  }

  for (const ex of existing) {
    if (!staging.find(s => s.externalId === ex.externalId)) {
      diffs.push({ externalId: ex.externalId, type: 'delete', before: ex, after: null })
    }
  }

  const run = await prisma.importRun.create({
    data: { supplierId, status: 'started', summary: { counts: summarize(diffs) } as any },
  })
  if (diffs.length) {
    await prisma.importDiff.createMany({
      data: diffs.map(d => ({
        importRunId: run.id,
        externalId: d.externalId,
        diffType: d.type,
        before: d.before as any,
        after: d.after as any,
      })),
    })
  }
  return run.id
}

function summarize(diffs: { type: string }[]) {
  const acc: Record<string, number> = {}
  for (const d of diffs) acc[d.type] = (acc[d.type] || 0) + 1
  return acc
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
