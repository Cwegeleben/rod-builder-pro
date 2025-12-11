import type { Prisma } from '@prisma/client'
import { prisma } from '../db.server'
import type { DiffKind, FieldChange, ProductSnapshot } from '../domain/imports/diffTypes'

export type ProductImportRunSummary = {
  id: string
  supplierSlug: string
  supplierId: string | null
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  totalAdds: number
  totalChanges: number
  totalDeletes: number
  summary: Record<string, unknown> | null
}

export type ProductImportRunItemView = {
  id: string
  runId: string
  supplierSlug: string
  supplierSiteId: string | null
  productCode: string
  category: string
  family: string | null
  kind: DiffKind
  beforeSnapshot: ProductSnapshot | null
  afterSnapshot: ProductSnapshot | null
  changedFields: FieldChange[]
  createdAt: string
}

export type ProductImportRunDetail = {
  run: ProductImportRunSummary
  items: ProductImportRunItemView[]
  itemsByKind: Record<DiffKind, ProductImportRunItemView[]>
}

type ListOptions = {
  supplierSlug?: string | null
  status?: string | null
  limit?: number
}

const RUN_SUMMARY_SELECT = {
  id: true,
  supplierSlug: true,
  supplierId: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  totalAdds: true,
  totalChanges: true,
  totalDeletes: true,
  summary: true,
} satisfies Prisma.ProductImportRunSelect

type RunSummaryRow = Prisma.ProductImportRunGetPayload<{ select: typeof RUN_SUMMARY_SELECT }>

export async function listProductImportRuns(options: ListOptions = {}): Promise<ProductImportRunSummary[]> {
  const where: Prisma.ProductImportRunWhereInput = {}
  if (options.supplierSlug) where.supplierSlug = options.supplierSlug
  if (options.status) where.status = options.status

  const take = clampLimit(options.limit)
  const runs = await prisma.productImportRun.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take,
    select: RUN_SUMMARY_SELECT,
  })

  return runs.map(mapRunSummary)
}

export async function getProductImportRunDetail(runId: string): Promise<ProductImportRunDetail | null> {
  if (!runId) return null
  const run = await prisma.productImportRun.findUnique({
    where: { id: runId },
    select: {
      ...RUN_SUMMARY_SELECT,
      items: {
        orderBy: { createdAt: 'asc' },
        select: RUN_ITEM_SELECT,
      },
    },
  })
  if (!run) return null

  const runSummary = mapRunSummary(run)
  const items = run.items.map(mapRunItem)
  const itemsByKind: Record<DiffKind, ProductImportRunItemView[]> = {
    add: [],
    change: [],
    delete: [],
  }
  for (const item of items) {
    itemsByKind[item.kind].push(item)
  }

  return { run: runSummary, items, itemsByKind }
}

function mapRunSummary(row: RunSummaryRow): ProductImportRunSummary {
  const startedAtIso = row.startedAt.toISOString()
  const finishedAtIso = row.finishedAt ? row.finishedAt.toISOString() : null
  const durationMs = row.finishedAt ? row.finishedAt.getTime() - row.startedAt.getTime() : null
  return {
    id: row.id,
    supplierSlug: row.supplierSlug,
    supplierId: row.supplierId ?? null,
    status: row.status,
    startedAt: startedAtIso,
    finishedAt: finishedAtIso,
    durationMs,
    totalAdds: row.totalAdds,
    totalChanges: row.totalChanges,
    totalDeletes: row.totalDeletes,
    summary: coerceJsonObject(row.summary),
  }
}

type RunItemRow = Prisma.ProductImportRunItemGetPayload<{ select: typeof RUN_ITEM_SELECT }>

function mapRunItem(row: RunItemRow): ProductImportRunItemView {
  return {
    id: row.id,
    runId: row.runId,
    supplierSlug: row.supplierSlug,
    supplierSiteId: row.supplierSiteId ?? null,
    productCode: row.productCode,
    category: row.category,
    family: row.family ?? null,
    kind: row.kind as DiffKind,
    beforeSnapshot: coerceSnapshot(row.beforeSnapshot),
    afterSnapshot: coerceSnapshot(row.afterSnapshot),
    changedFields: coerceFieldChanges(row.changedFields),
    createdAt: row.createdAt.toISOString(),
  }
}

const RUN_ITEM_SELECT = {
  id: true,
  runId: true,
  supplierSlug: true,
  supplierSiteId: true,
  productCode: true,
  category: true,
  family: true,
  kind: true,
  beforeSnapshot: true,
  afterSnapshot: true,
  changedFields: true,
  createdAt: true,
} satisfies Prisma.ProductImportRunItemSelect

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return 50
  return Math.min(200, Math.max(1, Math.floor(limit)))
}

function coerceSnapshot(value: Prisma.JsonValue | null): ProductSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const attrs = record.attributes
  return {
    brand: typeof record.brand === 'string' ? record.brand : undefined,
    series: typeof record.series === 'string' ? record.series : undefined,
    material: typeof record.material === 'string' ? record.material : undefined,
    color: typeof record.color === 'string' ? record.color : undefined,
    msrp: typeof record.msrp === 'number' ? record.msrp : undefined,
    availability: typeof record.availability === 'string' ? record.availability : undefined,
    category: typeof record.category === 'string' ? record.category : 'unknown',
    family: typeof record.family === 'string' ? record.family : undefined,
    designStudioReady: typeof record.designStudioReady === 'boolean' ? record.designStudioReady : undefined,
    attributes:
      attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? { ...(attrs as Record<string, unknown>) } : {},
  }
}

function coerceFieldChanges(value: Prisma.JsonValue | null): FieldChange[] {
  if (!Array.isArray(value)) return []
  const list: FieldChange[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    if (typeof record.field !== 'string') continue
    list.push({ field: record.field, before: record.before, after: record.after })
  }
  return list
}

function coerceJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return { ...(value as Record<string, unknown>) }
}

// Re-export common select so routes can avoid repeating shape when needed
export type { RunSummaryRow }
