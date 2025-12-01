import type { DesignStorefrontPartRole } from '../../lib/designStudio/storefront.mock'
import { isDesignStorefrontPartRole } from '../../lib/designStudio/storefront.server'

export type StorefrontOptionSnapshot = {
  id: string
  title: string
  price: number
  sku?: string | null
  vendor?: string | null
  notes?: string | null
  badge?: string | null
}

export type StorefrontSelectionSnapshot = {
  role: DesignStorefrontPartRole
  option: StorefrontOptionSnapshot
}

export type StorefrontSummarySnapshot = {
  totalParts: number
  selectedParts: number
  subtotal: number
  basePrice: number
}

export type StorefrontStepSnapshot = {
  id: string
  label?: string
  roles: DesignStorefrontPartRole[]
}

export type StorefrontBuildPayload = {
  selections: StorefrontSelectionSnapshot[]
  summary: StorefrontSummarySnapshot
  steps?: StorefrontStepSnapshot[]
  hero?: { title?: string; body?: string } | null
  featureFlags?: string[]
  customer?: {
    name?: string
    email?: string
    phone?: string
  }
  notes?: string | null
}

export type NormalizedSelection = {
  role: DesignStorefrontPartRole
  option: Required<StorefrontOptionSnapshot>
}

export type NormalizedStorefrontPayload = {
  selections: NormalizedSelection[]
  summary: StorefrontSummarySnapshot
  steps: StorefrontStepSnapshot[]
  hero?: { title?: string; body?: string } | null
  featureFlags: string[]
  customer?: {
    name?: string | null
    email?: string | null
    phone?: string | null
  }
  notes?: string | null
}

type NormalizeOptions = {
  requireSelections?: boolean
}

export function normalizeStorefrontPayload(
  payload: StorefrontBuildPayload | null | undefined,
  options: NormalizeOptions = {},
): NormalizedStorefrontPayload {
  const selections = Array.isArray(payload?.selections) ? payload?.selections : []
  const normalizedSelections: NormalizedSelection[] = selections
    .map(entry => normalizeSelection(entry))
    .filter((entry): entry is NormalizedSelection => !!entry)

  if (options.requireSelections !== false && normalizedSelections.length === 0) {
    throw new Error('No selections available to persist')
  }

  const summary = normalizeSummary(payload?.summary)
  const steps = Array.isArray(payload?.steps) ? payload?.steps : []
  const featureFlags = Array.isArray(payload?.featureFlags) ? payload?.featureFlags.filter(isTruthyString) : []

  return {
    selections: normalizedSelections,
    summary,
    steps,
    hero: payload?.hero ?? null,
    featureFlags,
    customer: {
      name: payload?.customer?.name ?? null,
      email: payload?.customer?.email ?? null,
      phone: payload?.customer?.phone ?? null,
    },
    notes: payload?.notes ?? null,
  }
}

export function truncate(value: string | null | undefined, limit = 120): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const safeLimit = Math.max(limit, 3)
  return trimmed.length > safeLimit ? `${trimmed.slice(0, safeLimit - 3)}...` : trimmed
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = truncate(value, 180)
  return normalized ? normalized.toLowerCase() : null
}

function normalizeSelection(entry: StorefrontSelectionSnapshot | null | undefined): NormalizedSelection | null {
  if (!entry || typeof entry !== 'object') return null
  const roleValue = entry.role
  if (!isDesignStorefrontPartRole(roleValue)) return null
  const option = entry.option
  if (!option || typeof option !== 'object') return null
  const title = typeof option.title === 'string' ? option.title.trim() : ''
  if (!title) return null
  const price = Number(option.price)
  return {
    role: roleValue,
    option: {
      id: String(option.id || ''),
      title,
      price: Number.isFinite(price) ? Math.max(price, 0) : 0,
      sku: option.sku ? String(option.sku) : option.id ? String(option.id) : null,
      vendor: option.vendor ? truncate(option.vendor, 120) : null,
      notes: option.notes ? truncate(option.notes, 240) : null,
      badge: option.badge ? truncate(option.badge, 60) : null,
    },
  }
}

function normalizeSummary(summary: StorefrontSummarySnapshot | undefined): StorefrontSummarySnapshot {
  if (!summary) {
    return { basePrice: 0, subtotal: 0, selectedParts: 0, totalParts: 0 }
  }
  const coerce = (value: unknown) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }
  return {
    basePrice: coerce(summary.basePrice),
    subtotal: coerce(summary.subtotal),
    selectedParts: coerce(summary.selectedParts),
    totalParts: coerce(summary.totalParts),
  }
}

function isTruthyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
