// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import { prisma } from '../../db.server'
import type { Prisma } from '@prisma/client'

export type ColumnDef = { key: string; label: string; type: 'string' | 'number' | 'boolean' | 'money' | 'enum' | 'url' }
export type RowCore = {
  id: string
  title: string | null
  externalId: string
  vendor: string
  status: 'staged' | 'approved' | 'rejected'
  confidence: number | null
  price?: number | null
  availability?: string | null
  shopifyProductId?: string | null
}
export type Row = {
  core: RowCore
  attributes: Record<string, unknown>
  diffClass: 'add' | 'change' | 'nochange' | 'conflict'
}
export type Totals = { unlinked: number; linked: number; conflicts: number; all: number }
type PartLike = {
  title?: string | null
  normSpecs?: Record<string, unknown> | null
  priceWh?: number | string | null
  priceMsrp?: number | string | null
  images?: string[] | null
  sourceUrl?: string | null
  availability?: string | null
  hashContent?: string | null
  vendor?: string | null
}

export type ListParams = {
  runId: string
  tab: 'unlinked' | 'linked' | 'conflicts' | 'all'
  page: number
  pageSize: number
  filters: {
    vendor?: string[]
    status?: Array<'staged' | 'approved' | 'rejected'>
    confidenceMin?: number
    confidenceMax?: number
    availability?: string[]
    q?: string
    attribute?: { key: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'; value: string }
  }
}

const columnsCache: Map<string, { columns: ColumnDef[]; expiresAt: number }> = new Map()
const TEN_MIN = 10 * 60 * 1000

export async function computeColumnsRegistry(runId: string): Promise<ColumnDef[]> {
  const cached = columnsCache.get(runId)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.columns

  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return []
  // Sample some diffs to infer keys from PartStaging.normSpecs
  const sample = await prisma.importDiff.findMany({
    where: { importRunId: runId },
    take: 200,
    orderBy: { id: 'asc' },
    select: { after: true },
  })
  const freq = new Map<string, number>()
  for (const s of sample) {
    const after = (s.after as unknown as PartLike) || {}
    const specs = (after?.normSpecs as Record<string, unknown>) || {}
    for (const k of Object.keys(specs)) freq.set(k, (freq.get(k) || 0) + 1)
  }
  // Pick top keys by frequency
  const keys = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([k]) => k)

  const columns: ColumnDef[] = keys.map(k => ({ key: k, label: labelize(k), type: 'string' }))
  columnsCache.set(runId, { columns, expiresAt: now + TEN_MIN })
  return columns
}

export async function computeTotals(runId: string): Promise<Totals> {
  const [adds, changes, conflicts, all] = await Promise.all([
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'add' } }),
    prisma.importDiff.count({ where: { importRunId: runId, diffType: { in: ['change', 'delete'] } } }),
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'conflict' } }),
    prisma.importDiff.count({ where: { importRunId: runId } }),
  ])
  return { unlinked: adds, linked: changes, conflicts, all }
}

export async function queryStagedRows(
  params: ListParams,
): Promise<{ rows: Row[]; page: number; pageSize: number; totalPages: number }> {
  const { runId, tab, page, pageSize, filters } = params
  const where: Prisma.ImportDiffWhereInput = { importRunId: runId }
  if (tab === 'unlinked') where.diffType = 'add'
  else if (tab === 'linked') where.diffType = { in: ['change', 'delete'] }
  else if (tab === 'conflicts') where.diffType = 'conflict'

  // status filter -> resolution
  if (filters.status && filters.status.length) {
    const wantStaged = filters.status.includes('staged')
    const wantApproved = filters.status.includes('approved')
    const wantRejected = filters.status.includes('rejected')
    const inValues: string[] = []
    if (wantApproved) inValues.push('approve')
    if (wantRejected) inValues.push('reject')
    if (wantStaged && inValues.length) {
      // Mixed staged + others
      ;(where as Prisma.ImportDiffWhereInput).OR = [{ resolution: null }, { resolution: { in: inValues } }]
    } else if (wantStaged) {
      where.resolution = null
    } else if (inValues.length) {
      where.resolution = { in: inValues }
    }
  }

  // q filter
  const q = (filters.q || '').trim()
  const allRows = await prisma.importDiff.findMany({
    where,
    orderBy: { id: 'asc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, externalId: true, diffType: true, before: true, after: true, resolution: true },
  })
  // Note: We perform text filtering client-side on fetched page to keep SQL simple; acceptable with small pages
  const rows: Row[] = []
  for (const d of allRows) {
    const before = (d.before as unknown as PartLike) || null
    const after = (d.after as unknown as PartLike) || null
    const title = (after?.title || before?.title || null) as string | null
    if (q) {
      const hay = `${title || ''} ${d.externalId}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) continue
    }
    const core: RowCore = {
      id: d.id,
      title,
      externalId: d.externalId,
      vendor: inferVendor(before, after),
      status: mapResolutionToStatus(d.resolution),
      confidence: estimateConfidence(before, after, d.diffType as string),
      price: extractPrice(after) ?? extractPrice(before) ?? null,
      availability: extractAvailability(after) ?? extractAvailability(before) ?? null,
      shopifyProductId: null,
    }
    const attrs = (after?.normSpecs as Record<string, unknown>) || {}
    const diffClass = mapDiffType(d.diffType as string)
    rows.push({ core, attributes: attrs, diffClass })
  }
  // Post-filtering for non-indexed fields (vendor, availability, confidence, attribute)
  const filtered = rows.filter(r => {
    if (filters.vendor && filters.vendor.length && !filters.vendor.includes(r.core.vendor)) return false
    if (
      filters.availability &&
      filters.availability.length &&
      !filters.availability.includes(r.core.availability || '')
    )
      return false
    if (typeof filters.confidenceMin === 'number' && (r.core.confidence ?? 0) < filters.confidenceMin) return false
    if (typeof filters.confidenceMax === 'number' && (r.core.confidence ?? 0) > filters.confidenceMax) return false
    if (filters.attribute) {
      const { key, operator, value } = filters.attribute
      const v = r.attributes[key]
      if (!attributeCompare(v, operator, value)) return false
    }
    return true
  })

  const total = await prisma.importDiff.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows: filtered, page, pageSize, totalPages }
}

export async function getRowDetails(
  runId: string,
  rowId: string,
): Promise<{
  changedFields: Array<{
    key: string
    before?: unknown
    after?: unknown
    confidence?: number
    class: 'add' | 'update' | 'conflict'
  }>
  sourceUrl?: string | null
  images?: string[]
  attributesSubset?: Record<string, unknown>
}> {
  const d = await prisma.importDiff.findUnique({ where: { id: rowId } })
  if (!d || d.importRunId !== runId) return { changedFields: [] }
  const before = (d.before as unknown as PartLike) || null
  const after = (d.after as unknown as PartLike) || null
  const changedFields = diffChangedFields(before, after)
  const images = (after?.images as string[]) || []
  const sourceUrl = (after?.sourceUrl as string) || null
  const attributesSubset = (after?.normSpecs as Record<string, unknown>) || {}
  return { changedFields, sourceUrl, images, attributesSubset }
}

function mapResolutionToStatus(r: string | null | undefined): 'staged' | 'approved' | 'rejected' {
  if (r === 'approve') return 'approved'
  if (r === 'reject') return 'rejected'
  return 'staged'
}
function mapDiffType(t: string): 'add' | 'change' | 'nochange' | 'conflict' {
  if (t === 'conflict') return 'conflict'
  if (t === 'add') return 'add'
  if (t === 'change' || t === 'delete') return 'change'
  return 'nochange'
}
function labelize(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase())
}
function inferVendor(before: PartLike | null, after: PartLike | null): string {
  return (after?.vendor || before?.vendor || 'Supplier') as string
}
function extractPrice(obj: PartLike | null | undefined): number | null {
  const p = obj?.priceWh ?? obj?.priceMsrp
  if (p == null) return null
  if (typeof p === 'number') return p
  if (typeof p === 'string') {
    const n = Number(p)
    return Number.isFinite(n) ? n : null
  }
  return null
}
function extractAvailability(obj: PartLike | null | undefined): string | null {
  return (obj?.normSpecs?.availability as string) || (obj?.availability as string) || null
}
function estimateConfidence(before: PartLike | null, after: PartLike | null, diffType: string): number {
  if (diffType === 'add') return 0.6
  const changes = diffChangedFields(before, after)
  const count = changes.length
  if (count === 0) return 1.0
  if (count < 3) return 0.85
  if (count < 8) return 0.75
  return 0.65
}
function attributeCompare(v: unknown, op: 'eq' | 'neq' | 'gt' | 'lt' | 'contains', expected: string): boolean {
  if (op === 'contains')
    return String(v ?? '')
      .toLowerCase()
      .includes(String(expected).toLowerCase())
  const vn = Number(v as unknown as string)
  const en = Number(expected)
  switch (op) {
    case 'eq':
      return String(v) === expected
    case 'neq':
      return String(v) !== expected
    case 'gt':
      return Number.isFinite(vn) && Number.isFinite(en) ? vn > en : false
    case 'lt':
      return Number.isFinite(vn) && Number.isFinite(en) ? vn < en : false
    default:
      return false
  }
}
function diffChangedFields(
  before: PartLike | null,
  after: PartLike | null,
): Array<{
  key: string
  before?: unknown
  after?: unknown
  confidence?: number
  class: 'add' | 'update' | 'conflict'
}> {
  const out: Array<{
    key: string
    before?: unknown
    after?: unknown
    confidence?: number
    class: 'add' | 'update' | 'conflict'
  }> = []
  const keys = new Set<string>()
  const bSpecs = (before?.normSpecs || {}) as Record<string, unknown>
  const aSpecs = (after?.normSpecs || {}) as Record<string, unknown>
  for (const k of Object.keys(bSpecs)) keys.add(k)
  for (const k of Object.keys(aSpecs))
    keys.add(k)
    // include a few core fields
  ;['title', 'priceWh', 'priceMsrp'].forEach(k => keys.add(k))
  const bObj = (before || {}) as Record<string, unknown>
  const aObj = (after || {}) as Record<string, unknown>
  for (const k of keys) {
    const b = k in aSpecs || k in bSpecs ? bSpecs[k] : bObj[k]
    const a = k in aSpecs || k in bSpecs ? aSpecs[k] : aObj[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ key: k, before: b, after: a, class: b == null ? 'add' : 'update', confidence: 0.9 })
    }
  }
  return out.slice(0, 24)
}

// <!-- END RBP GENERATED: importer-review-inline-v1 -->
