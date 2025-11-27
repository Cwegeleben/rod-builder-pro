import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { DesignBuildEventType, DesignFulfillmentMode } from '@prisma/client'
import { prisma } from '../../db.server'
import type { DesignStudioAccess } from '../../lib/designStudio/access.server'
import { isDesignStorefrontPartRole } from '../../lib/designStudio/storefront.server'
import type { DesignStorefrontPartRole } from '../../lib/designStudio/storefront.mock'

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

export type CreateStorefrontBuildResult = {
  id: string
  reference: string
}

type NormalizedSelection = {
  role: DesignStorefrontPartRole
  option: Required<StorefrontOptionSnapshot>
}

type NormalizedPayload = {
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

export async function createDesignStorefrontBuild({
  access,
  payload,
}: {
  access: DesignStudioAccess
  payload: StorefrontBuildPayload
}): Promise<CreateStorefrontBuildResult> {
  if (!access.enabled) {
    throw new Error('Design Studio access disabled for shop')
  }
  if (!access.shopDomain) {
    throw new Error('Missing shop domain for Design Studio submission')
  }

  const normalized = normalizePayload(payload)
  if (!normalized.selections.length) {
    throw new Error('No selections available to persist')
  }

  const blankSelection = normalized.selections.find(entry => entry.role === 'blank') ?? null
  const componentSummary = buildComponentSummary(normalized)
  const metadata = buildMetadata(normalized)
  const now = new Date()
  const baseCreate: Prisma.DesignBuildCreateInput = {
    reference: 'pending',
    shopDomain: access.shopDomain,
    tier: access.tier,
    status: 'REVIEW',
    fulfillmentMode: DesignFulfillmentMode.RBP_BUILD,
    customerName: truncate(normalized.customer?.name),
    customerEmail: normalizeEmail(normalized.customer?.email),
    customerPhone: truncate(normalized.customer?.phone, 40),
    blankSku: blankSelection?.option.sku ?? blankSelection?.option.id ?? null,
    blankTitle: blankSelection?.option.title ?? null,
    componentSummary: componentSummary as Prisma.InputJsonValue,
    metadata: metadata as Prisma.InputJsonValue,
    notesJson: normalized.notes ?? null,
    bomHash: hashSelections(normalized.selections),
    submittedAt: now,
  }

  const build = await persistWithReference(baseCreate, access.shopDomain)

  await prisma.designBuildEvent.create({
    data: {
      buildId: build.id,
      eventType: DesignBuildEventType.CUSTOMER_UPDATE,
      payload: {
        submittedAt: now.toISOString(),
        subtotal: normalized.summary.subtotal,
        selectedParts: normalized.summary.selectedParts,
        source: 'storefront',
      },
    },
  })

  return { id: build.id, reference: build.reference }
}

async function persistWithReference(baseCreate: Prisma.DesignBuildCreateInput, shopDomain: string) {
  const attempts = 5
  for (let attempt = 0; attempt < attempts; attempt++) {
    const reference = generateReference(shopDomain, attempt)
    try {
      return await prisma.designBuild.create({
        data: { ...baseCreate, reference },
      })
    } catch (error) {
      if (!isUniqueReferenceError(error)) {
        throw error
      }
    }
  }
  throw new Error('Unable to allocate Design Build reference')
}

function generateReference(shopDomain: string, attempt: number): string {
  const base =
    shopDomain
      .replace(/\.myshopify\.com$/i, '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase() || 'RBP'
  const suffix = crypto.randomInt(0, 999999).toString().padStart(6, '0')
  const attemptToken = attempt ? `-${attempt}` : ''
  return `DS-${base.slice(0, 4)}-${suffix}${attemptToken}`
}

function normalizePayload(payload: StorefrontBuildPayload): NormalizedPayload {
  const selections = Array.isArray(payload.selections) ? payload.selections : []
  const normalizedSelections: NormalizedSelection[] = selections
    .map(entry => normalizeSelection(entry))
    .filter((entry): entry is NormalizedSelection => !!entry)

  const summary = normalizeSummary(payload.summary)
  const steps = Array.isArray(payload.steps) ? payload.steps : []
  const featureFlags = Array.isArray(payload.featureFlags) ? payload.featureFlags.filter(isTruthyString) : []

  return {
    selections: normalizedSelections,
    summary,
    steps,
    hero: payload.hero ?? null,
    featureFlags,
    customer: {
      name: payload.customer?.name ?? null,
      email: payload.customer?.email ?? null,
      phone: payload.customer?.phone ?? null,
    },
    notes: payload.notes ?? null,
  }
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

function buildComponentSummary(payload: NormalizedPayload) {
  const blank = payload.selections.find(entry => entry.role === 'blank')
  const components = payload.selections.filter(entry => entry.role !== 'blank').map(entry => serializeComponent(entry))

  return {
    blank: blank ? serializeComponent(blank) : null,
    components,
    pricing: payload.summary,
  }
}

function serializeComponent(entry: NormalizedSelection) {
  return {
    role: entry.role,
    sku: entry.option.sku,
    title: entry.option.title,
    price: entry.option.price,
    vendor: entry.option.vendor,
    notes: entry.option.notes,
    badge: entry.option.badge,
  }
}

function buildMetadata(payload: NormalizedPayload) {
  return {
    hero: payload.hero,
    summary: payload.summary,
    featureFlags: payload.featureFlags,
    steps: payload.steps?.map(step => ({
      id: step.id,
      label: step.label,
      roles: Array.isArray(step.roles) ? step.roles.filter(isDesignStorefrontPartRole) : [],
    })),
  }
}

function hashSelections(selections: NormalizedSelection[]) {
  const digest = crypto.createHash('sha1').update(JSON.stringify(selections)).digest('hex')
  return digest
}

function truncate(value: string | null | undefined, limit = 120): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const safeLimit = Math.max(limit, 3)
  return trimmed.length > safeLimit ? `${trimmed.slice(0, safeLimit - 3)}...` : trimmed
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = truncate(value, 180)
  return normalized ? normalized.toLowerCase() : null
}

function isTruthyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isUniqueReferenceError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'
}
