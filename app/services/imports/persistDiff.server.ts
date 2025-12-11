import { Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import type { ProductDiff } from '../../domain/imports/diffTypes'

export type SaveImportRunDiffInput = {
  supplierSlug: string
  supplierId?: string | null
  diffs: ProductDiff[]
  startedAt?: Date
  finishedAt?: Date
  status?: string
  summary?: Prisma.JsonValue | null
}

export type SaveImportRunDiffResult = {
  run: Awaited<ReturnType<typeof prisma.productImportRun.create>>
  counts: {
    adds: number
    changes: number
    deletes: number
  }
}

export async function saveImportRunDiff(input: SaveImportRunDiffInput): Promise<SaveImportRunDiffResult> {
  const startedAt = input.startedAt ?? new Date()
  const finishedAt = input.finishedAt ?? startedAt
  const status = input.status ?? 'diffed'
  const counts = tallyDiffCounts(input.diffs)

  const run = await prisma.$transaction(async tx => {
    const createdRun = await tx.productImportRun.create({
      data: {
        supplierSlug: input.supplierSlug,
        supplierId: input.supplierId ?? null,
        startedAt,
        finishedAt,
        status,
        totalAdds: counts.adds,
        totalChanges: counts.changes,
        totalDeletes: counts.deletes,
        summary: input.summary ?? Prisma.JsonNull,
      },
    })

    if (input.diffs.length) {
      await tx.productImportRunItem.createMany({
        data: input.diffs.map(diff => ({
          runId: createdRun.id,
          supplierSlug: diff.supplier,
          supplierSiteId: diff.supplierSiteId ?? null,
          productCode: diff.productCode,
          category: diff.category,
          family: diff.family ?? null,
          kind: diff.kind,
          beforeSnapshot: toJsonValue(diff.before),
          afterSnapshot: toJsonValue(diff.after),
          changedFields:
            diff.changedFields && diff.changedFields.length ? toJsonValue(diff.changedFields) : Prisma.JsonNull,
        })),
      })
    }

    return createdRun
  })

  return { run, counts }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function tallyDiffCounts(diffs: ProductDiff[]) {
  let adds = 0
  let changes = 0
  let deletes = 0
  for (const diff of diffs) {
    if (diff.kind === 'add') adds += 1
    else if (diff.kind === 'change') changes += 1
    else if (diff.kind === 'delete') deletes += 1
  }
  return { adds, changes, deletes }
}
