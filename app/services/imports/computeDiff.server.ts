import { Prisma } from '@prisma/client'
import type { FieldChange, ProductDiff, ProductSnapshot } from '../../domain/imports/diffTypes'

const CORE_FIELDS: (keyof ProductSnapshot)[] = [
  'brand',
  'series',
  'material',
  'color',
  'msrp',
  'availability',
  'category',
  'family',
  'designStudioReady',
]

export interface ProductSnapshotSource {
  supplier: string
  supplierSiteId?: string | null
  productCode: string
  brand?: string | null
  series?: string | null
  material?: string | null
  color?: string | null
  msrp?: number | string | Prisma.Decimal | null
  availability?: string | null
  category?: string | null
  family?: string | null
  designStudioReady?: boolean | null
  attributes?: Prisma.JsonValue | Record<string, unknown> | null
}

export interface SnapshotRecord {
  supplier: string
  supplierSiteId?: string | null
  productCode: string
  snapshot: ProductSnapshot
}

export interface ComputeDiffResult {
  diffs: ProductDiff[]
  summary: {
    adds: number
    changes: number
    deletes: number
  }
}

export function buildSnapshotFromSource(source: ProductSnapshotSource): SnapshotRecord {
  return {
    supplier: source.supplier,
    supplierSiteId: source.supplierSiteId ?? null,
    productCode: source.productCode,
    snapshot: {
      brand: valueOrUndefined(source.brand),
      series: valueOrUndefined(source.series),
      material: valueOrUndefined(source.material),
      color: valueOrUndefined(source.color),
      msrp: coerceNumber(source.msrp),
      availability: valueOrUndefined(source.availability),
      category: valueOrUndefined(source.category) ?? 'unknown',
      family: valueOrUndefined(source.family),
      designStudioReady: typeof source.designStudioReady === 'boolean' ? source.designStudioReady : undefined,
      attributes: coerceAttributes(source.attributes),
    },
  }
}

export function computeDiff(existing: SnapshotRecord[], staging: SnapshotRecord[]): ComputeDiffResult {
  const existingByCode = new Map(existing.map(entry => [entry.productCode, entry]))
  const stagingByCode = new Map(staging.map(entry => [entry.productCode, entry]))
  const diffs: ProductDiff[] = []

  for (const [productCode, stagingEntry] of stagingByCode) {
    const existingEntry = existingByCode.get(productCode)
    if (!existingEntry) {
      diffs.push({
        supplier: stagingEntry.supplier,
        supplierSiteId: stagingEntry.supplierSiteId ?? null,
        productCode,
        category: stagingEntry.snapshot.category,
        family: stagingEntry.snapshot.family,
        kind: 'add',
        after: stagingEntry.snapshot,
      })
      continue
    }
    const changes = computeFieldChanges(existingEntry.snapshot, stagingEntry.snapshot)
    if (changes.length === 0) continue
    diffs.push({
      supplier: stagingEntry.supplier,
      supplierSiteId: stagingEntry.supplierSiteId ?? null,
      productCode,
      category: stagingEntry.snapshot.category,
      family: stagingEntry.snapshot.family,
      kind: 'change',
      before: existingEntry.snapshot,
      after: stagingEntry.snapshot,
      changedFields: changes,
    })
  }

  for (const [productCode, existingEntry] of existingByCode) {
    if (stagingByCode.has(productCode)) continue
    diffs.push({
      supplier: existingEntry.supplier,
      supplierSiteId: existingEntry.supplierSiteId ?? null,
      productCode,
      category: existingEntry.snapshot.category,
      family: existingEntry.snapshot.family,
      kind: 'delete',
      before: existingEntry.snapshot,
    })
  }

  const summary = {
    adds: diffs.filter(diff => diff.kind === 'add').length,
    changes: diffs.filter(diff => diff.kind === 'change').length,
    deletes: diffs.filter(diff => diff.kind === 'delete').length,
  }

  return { diffs, summary }
}

export function computeFieldChanges(before: ProductSnapshot, after: ProductSnapshot): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of CORE_FIELDS) {
    if (!deepEqual(before[field], after[field])) {
      changes.push({ field, before: before[field], after: after[field] })
    }
  }
  const beforeAttributes = before.attributes || {}
  const afterAttributes = after.attributes || {}
  const attributeKeys = new Set([...Object.keys(beforeAttributes), ...Object.keys(afterAttributes)])
  for (const key of attributeKeys) {
    const beforeValue = beforeAttributes[key]
    const afterValue = afterAttributes[key]
    if (!deepEqual(beforeValue, afterValue)) {
      changes.push({ field: `attributes.${key}`, before: beforeValue, after: afterValue })
    }
  }
  return changes
}

function valueOrUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined || value === '' ? undefined : value
}

function coerceNumber(value: number | string | Prisma.Decimal | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  if (isDecimal(value)) {
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function isDecimal(value: unknown): value is Prisma.Decimal {
  if (!value) return false
  if (typeof Prisma.Decimal?.isDecimal === 'function' && Prisma.Decimal.isDecimal(value)) return true
  return typeof Prisma.Decimal === 'function' && value instanceof Prisma.Decimal
}

function coerceAttributes(
  value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!value) return {}
  if (Array.isArray(value)) return {}
  if (typeof value === 'object') {
    return { ...value }
  }
  return {}
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((value, index) => deepEqual(value, b[index]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  }
  return false
}
