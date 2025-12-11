import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import type { DiffKind } from '../../domain/imports/diffTypes'
import type { BatsonNormalizedRecord } from '../../domain/catalog/batsonNormalizedTypes'
import { applyBatsonProducts, type BatsonApplyInput } from '../suppliers/batsonApply.server'

export type ApplyImportRunOptions = {
  kinds?: DiffKind[]
  actor?: string | null
}

export type ApplyImportRunResult = {
  runId: string
  supplierSlug: string
  appliedAt: string
  counts: {
    addsAttempted: number
    addsApplied: number
    changesAttempted: number
    changesApplied: number
    deletesAttempted: number
    deletesApplied: number
  }
  errors: ApplyRunItemError[]
}

export type ApplyRunItemError = {
  productCode: string
  reason: 'missing-staging' | 'invalid-normalized'
  message: string
}

const ALL_KINDS: DiffKind[] = ['add', 'change', 'delete']
const BATSON_SLUG_PREFIX = 'batson'

export async function applyImportRun(
  runId: string,
  options: ApplyImportRunOptions = {},
): Promise<ApplyImportRunResult> {
  if (!runId) throw new Error('runId required')
  const run = await prisma.productImportRun.findUnique({
    where: { id: runId },
    include: { items: true },
  })
  if (!run) throw new Error('Import run not found')
  if (run.status === 'applied') throw new Error('Run already applied')

  const supplierSlug = run.supplierSlug
  if (!supportsApplyStrategy(supplierSlug)) throw new Error(`Apply not supported for ${supplierSlug}`)
  const supplierId = run.supplierId ?? supplierSlug
  const targetKinds = new Set((options.kinds && options.kinds.length ? options.kinds : ALL_KINDS) as DiffKind[])

  const upsertItems = run.items.filter(
    item => targetKinds.has(item.kind as DiffKind) && (item.kind === 'add' || item.kind === 'change'),
  )
  const deleteItems = run.items.filter(item => targetKinds.has(item.kind as DiffKind) && item.kind === 'delete')

  const upsertCodes = Array.from(new Set(upsertItems.map(item => item.productCode)))
  const stagingRows = upsertCodes.length
    ? await prisma.partStaging.findMany({
        where: { supplierId: supplierSlug, externalId: { in: upsertCodes } },
        select: { externalId: true, title: true, description: true, images: true, normSpecs: true },
      })
    : []
  const stagingByCode = new Map(stagingRows.map(row => [row.externalId, row]))

  const errors: ApplyRunItemError[] = []
  const applyPayloads: Array<{ kind: DiffKind; input: BatsonApplyInput }> = []

  for (const item of upsertItems) {
    const staging = stagingByCode.get(item.productCode)
    if (!staging) {
      errors.push({
        productCode: item.productCode,
        reason: 'missing-staging',
        message: 'No staging row found for product',
      })
      continue
    }
    const normalized = coerceNormalizedRecord(staging.normSpecs)
    if (!normalized) {
      errors.push({
        productCode: item.productCode,
        reason: 'invalid-normalized',
        message: 'Staging row missing normalized payload',
      })
      continue
    }
    applyPayloads.push({
      kind: item.kind as DiffKind,
      input: {
        supplierId,
        supplierSiteId: item.supplierSiteId ?? supplierSlug,
        title: staging.title,
        description: staging.description ?? null,
        images: toInputJson(staging.images),
        normalized,
      },
    })
  }

  const preparedAdds = applyPayloads.filter(entry => entry.kind === 'add').length
  const preparedChanges = applyPayloads.filter(entry => entry.kind === 'change').length
  const targetedAdds = upsertItems.filter(item => item.kind === 'add').length
  const targetedChanges = upsertItems.filter(item => item.kind === 'change').length
  const targetedDeletes = deleteItems.length
  let addsApplied = 0
  let changesApplied = 0
  if (applyPayloads.length) {
    await applyBatsonProducts(
      applyPayloads.map(entry => entry.input),
      { mirror: false },
    )
    addsApplied = preparedAdds
    changesApplied = preparedChanges
  }

  let deletesApplied = 0
  const deleteCodes = deleteItems.map(item => item.productCode)
  if (deleteCodes.length) {
    const deleteResult = await prisma.product.updateMany({
      where: { supplierId, productCode: { in: deleteCodes } },
      data: { active: false, availability: 'OUT_OF_STOCK', updatedAt: new Date() },
    })
    deletesApplied = deleteResult.count
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const summaryPatch = buildApplySummary(run.summary, {
    appliedAt: nowIso,
    actor: options.actor ?? null,
    counts: {
      addsAttempted: targetedAdds,
      addsApplied,
      changesAttempted: targetedChanges,
      changesApplied,
      deletesAttempted: targetedDeletes,
      deletesApplied,
    },
    errors,
  })

  const nextStatus = errors.length ? 'applied_with_warnings' : 'applied'

  await prisma.productImportRun.update({
    where: { id: run.id },
    data: {
      status: nextStatus,
      finishedAt: now,
      summary: summaryPatch,
    },
  })

  const syncSummary = buildSyncSummary(
    run.id,
    supplierSlug,
    run.totalAdds,
    run.totalChanges,
    run.totalDeletes,
    summaryPatch,
  )

  await prisma.supplierSyncState.upsert({
    where: { supplierSlug },
    create: {
      supplierSlug,
      lastSyncStatus: errors.length ? 'partial' : 'applied',
      lastSyncAt: now,
      lastSyncSummary: syncSummary,
    },
    update: {
      lastSyncStatus: errors.length ? 'partial' : 'applied',
      lastSyncAt: now,
      lastSyncSummary: syncSummary,
    },
  })

  return {
    runId: run.id,
    supplierSlug,
    appliedAt: nowIso,
    counts: {
      addsAttempted: targetedAdds,
      addsApplied,
      changesAttempted: targetedChanges,
      changesApplied,
      deletesAttempted: targetedDeletes,
      deletesApplied,
    },
    errors,
  }
}

function coerceNormalizedRecord(value: Prisma.JsonValue | null): BatsonNormalizedRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.productCode !== 'string') return null
  return record as unknown as BatsonNormalizedRecord
}

function buildApplySummary(
  base: Prisma.JsonValue | null,
  patch: {
    appliedAt: string
    actor: string | null
    counts: ApplyImportRunResult['counts']
    errors: ApplyImportRunResult['errors']
  },
): Prisma.InputJsonValue {
  const next = base && typeof base === 'object' && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {}
  next.apply = {
    appliedAt: patch.appliedAt,
    actor: patch.actor,
    counts: patch.counts,
    errors: patch.errors,
  }
  const serialized = toInputJson(next)
  return (serialized ?? {}) as Prisma.InputJsonValue
}

function buildSyncSummary(
  runId: string,
  supplierSlug: string,
  adds: number,
  changes: number,
  deletes: number,
  summary: Prisma.InputJsonValue,
): Prisma.InputJsonValue {
  const serialized = toInputJson({
    runId,
    supplierSlug,
    totals: { adds, changes, deletes },
    summary,
  })
  return (serialized ?? {}) as Prisma.InputJsonValue
}

function supportsApplyStrategy(slug: string): boolean {
  return slug.startsWith(BATSON_SLUG_PREFIX)
}

function toInputJson(value: Prisma.JsonValue | Record<string, unknown> | null): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
