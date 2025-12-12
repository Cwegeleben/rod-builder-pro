import type { DesignStorefrontPartRole } from '../../lib/designStudio/storefront.mock'
import { isDesignStorefrontPartRole } from '../../lib/designStudio/storefront.server'
import {
  normalizeDesignStudioCompatibility,
  type DesignStudioCompatibility,
} from '../../lib/designStudio/compatibility'
import type { DesignStudioValidationEntry, DesignStudioValidationSeverity } from '../../lib/designStudio/validation'

export type StorefrontOptionSnapshot = {
  id: string
  title: string
  price: number
  sku?: string | null
  vendor?: string | null
  notes?: string | null
  badge?: string | null
  compatibility?: DesignStudioCompatibility | null
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
  validation?: StorefrontValidationSnapshot | null
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
  validation: StorefrontValidationSnapshot | null
}

export type StorefrontValidationSnapshot = {
  entries: DesignStudioValidationEntry[]
  hasCompatibilityIssues?: boolean
  updatedAt?: string | null
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
  const validation = normalizeValidationSnapshot(payload?.validation)

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
    validation,
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
  const compatibility = 'compatibility' in option ? normalizeDesignStudioCompatibility(option.compatibility) : null
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
      compatibility,
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

export function normalizeValidationSnapshot(
  snapshot: StorefrontValidationSnapshot | null | undefined,
): StorefrontValidationSnapshot | null {
  if (!snapshot || !Array.isArray(snapshot.entries)) {
    return null
  }
  const entries = snapshot.entries
    .map(entry => normalizeValidationEntry(entry))
    .filter((entry): entry is DesignStudioValidationEntry => entry !== null)
  return {
    entries,
    hasCompatibilityIssues: snapshot.hasCompatibilityIssues ?? entries.length > 0,
    updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : null,
  }
}

function normalizeValidationEntry(
  entry: DesignStudioValidationEntry | null | undefined,
): DesignStudioValidationEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const panelId = typeof entry.panelId === 'string' && entry.panelId.trim() ? entry.panelId.trim() : 'design-studio'
  const severity = normalizeSeverity(entry.severity)
  const code = typeof entry.code === 'string' && entry.code.trim() ? entry.code.trim() : 'unknown'
  const message =
    typeof entry.message === 'string' && entry.message.trim() ? entry.message.trim() : 'Compatibility issue detected.'
  return {
    panelId,
    severity,
    code,
    message,
    role: entry.role ?? null,
    optionId: entry.optionId ?? null,
    source: entry.source ?? 'draft',
  }
}

function normalizeSeverity(value: DesignStudioValidationSeverity | null | undefined): DesignStudioValidationSeverity {
  if (value === 'error' || value === 'warning') {
    return value
  }
  return 'info'
}
