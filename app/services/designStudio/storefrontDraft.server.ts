import crypto from 'node:crypto'
import type { DesignStorefrontDraft, Prisma } from '@prisma/client'
import { DesignStorefrontDraftStatus } from '@prisma/client'
import { prisma } from '../../db.server'
import type { DesignStudioAccess } from '../../lib/designStudio/access.server'
import { isDesignStorefrontPartRole } from '../../lib/designStudio/storefront.server'
import type { DesignStorefrontPartRole } from '../../lib/designStudio/storefront.mock'
import {
  normalizeStorefrontPayload,
  type NormalizedStorefrontPayload,
  type StorefrontBuildPayload,
  type StorefrontSelectionSnapshot,
  type StorefrontStepSnapshot,
  type StorefrontSummarySnapshot,
  type StorefrontValidationSnapshot,
  normalizeValidationSnapshot,
} from './storefrontPayload.server'

const DRAFT_TTL_DAYS = Math.max(Number(process.env.DESIGN_STOREFRONT_DRAFT_TTL_DAYS || '14'), 1)
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000
type DraftRecord = DesignStorefrontDraft
type DraftDataInput = Omit<Prisma.DesignStorefrontDraftUncheckedCreateInput, 'token' | 'shopDomain'>

export type StorefrontDraftSnapshot = {
  selections: StorefrontSelectionSnapshot[]
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
  validation?: StorefrontValidationSnapshot | null
}

export async function loadDesignStorefrontDraft({
  access,
  token,
}: {
  access: DesignStudioAccess
  token: string | null | undefined
}): Promise<StorefrontDraftSnapshot | null> {
  if (!access.enabled || !access.shopDomain || !token) return null
  const draft = await prisma.designStorefrontDraft.findUnique({ where: { token } })
  if (!draft || draft.shopDomain !== access.shopDomain) return null
  if (draft.status !== DesignStorefrontDraftStatus.ACTIVE) return null
  if (draft.expiresAt && draft.expiresAt.getTime() < Date.now()) {
    await prisma.designStorefrontDraft.update({
      where: { id: draft.id },
      data: { status: DesignStorefrontDraftStatus.EXPIRED },
    })
    return null
  }
  return deserializeDraft(draft)
}

export async function saveDesignStorefrontDraft({
  access,
  token,
  payload,
}: {
  access: DesignStudioAccess
  token: string | null | undefined
  payload: StorefrontBuildPayload
}): Promise<{ token: string | null }> {
  if (!access.enabled || !access.shopDomain) {
    throw new Error('Design Studio access disabled for this shop')
  }
  const normalized = normalizeStorefrontPayload(payload, { requireSelections: false })
  if (!normalized.selections.length) {
    if (token) {
      await expireDraft(token, access.shopDomain)
    }
    return { token: null }
  }
  const data = buildDraftData({ normalized, tier: access.tier })
  const nextToken = token && (await validateDraftToken(token, access.shopDomain)) ? token : null
  if (nextToken) {
    await prisma.designStorefrontDraft.update({
      where: { token: nextToken },
      data: {
        ...data,
        status: DesignStorefrontDraftStatus.ACTIVE,
      },
    })
    return { token: nextToken }
  }
  const createdToken = crypto.randomUUID()
  await prisma.designStorefrontDraft.create({
    data: {
      ...data,
      token: createdToken,
      shopDomain: access.shopDomain,
    },
  })
  return { token: createdToken }
}

export async function linkDraftToBuild({
  draftToken,
  buildId,
  shopDomain,
}: {
  draftToken?: string | null
  buildId: string
  shopDomain: string
}) {
  if (!draftToken) return
  const draft = await prisma.designStorefrontDraft.findUnique({ where: { token: draftToken } })
  if (!draft || draft.shopDomain !== shopDomain) return
  await prisma.$transaction([
    prisma.designStorefrontDraft.update({
      where: { id: draft.id },
      data: { status: DesignStorefrontDraftStatus.SUBMITTED, submittedAt: new Date() },
    }),
    prisma.designBuild.update({
      where: { id: buildId },
      data: { storefrontDraftId: draft.id },
    }),
  ])
}

async function expireDraft(token: string, shopDomain: string) {
  await prisma.designStorefrontDraft.updateMany({
    where: { token, shopDomain },
    data: { status: DesignStorefrontDraftStatus.EXPIRED },
  })
}

async function validateDraftToken(token: string, shopDomain: string) {
  const draft = await prisma.designStorefrontDraft.findUnique({ where: { token } })
  if (!draft || draft.shopDomain !== shopDomain) return null
  return draft
}

function buildDraftData({
  normalized,
  tier,
}: {
  normalized: NormalizedStorefrontPayload
  tier: DesignStudioAccess['tier']
}): DraftDataInput {
  return {
    tier,
    status: DesignStorefrontDraftStatus.ACTIVE,
    selections: normalized.selections as Prisma.InputJsonValue,
    summary: normalized.summary as Prisma.InputJsonValue,
    customer: normalized.customer as Prisma.InputJsonValue,
    metadata: {
      hero: normalized.hero,
      featureFlags: normalized.featureFlags,
      steps: normalized.steps,
      validation: normalized.validation,
    } as Prisma.InputJsonValue,
    notes: normalized.notes ?? null,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
  }
}

function deserializeDraft(record: DraftRecord): StorefrontDraftSnapshot {
  const metadata = (record.metadata as Record<string, unknown> | null) ?? null
  return {
    selections: coerceSelections(record.selections),
    summary: coerceSummary(record.summary),
    steps: coerceSteps(metadata?.steps),
    hero: coerceHero(metadata?.hero),
    featureFlags: coerceFeatureFlags(metadata?.featureFlags),
    customer: coerceCustomer(record.customer),
    notes: typeof record.notes === 'string' && record.notes.trim() ? record.notes : null,
    validation: coerceValidation(metadata?.validation),
  }
}

function coerceSelections(value: Prisma.JsonValue | null | undefined): StorefrontSelectionSnapshot[] {
  if (!Array.isArray(value)) return []
  const selections: StorefrontSelectionSnapshot[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const role = (entry as Record<string, unknown>).role
    if (!isDesignStorefrontPartRole(role)) continue
    const optionRaw = (entry as Record<string, unknown>).option
    if (!optionRaw || typeof optionRaw !== 'object') continue
    const optionRecord = optionRaw as Record<string, unknown>
    const title = typeof optionRecord.title === 'string' ? optionRecord.title : ''
    const id = optionRecord.id
    if (!title || typeof id !== 'string') continue
    selections.push({
      role,
      option: {
        id,
        title,
        price: Number(optionRecord.price) || 0,
        sku: typeof optionRecord.sku === 'string' ? optionRecord.sku : null,
        vendor: typeof optionRecord.vendor === 'string' ? optionRecord.vendor : null,
        notes: typeof optionRecord.notes === 'string' ? optionRecord.notes : null,
        badge: typeof optionRecord.badge === 'string' ? optionRecord.badge : null,
      },
    })
  }
  return selections
}

function coerceSummary(value: Prisma.JsonValue | null | undefined): StorefrontSummarySnapshot {
  if (!value || typeof value !== 'object') {
    return { basePrice: 0, subtotal: 0, selectedParts: 0, totalParts: 0 }
  }
  const record = value as Record<string, unknown>
  const toNumber = (val: unknown) => {
    const num = Number(val)
    return Number.isFinite(num) ? num : 0
  }
  return {
    basePrice: toNumber(record.basePrice),
    subtotal: toNumber(record.subtotal),
    selectedParts: toNumber(record.selectedParts),
    totalParts: toNumber(record.totalParts),
  }
}

function coerceSteps(value: unknown): StorefrontStepSnapshot[] {
  if (!Array.isArray(value)) return []
  const steps: StorefrontStepSnapshot[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) continue
    const rolesRaw = Array.isArray(record.roles) ? record.roles : []
    const roles = rolesRaw.filter(isDesignStorefrontPartRole) as DesignStorefrontPartRole[]
    steps.push({
      id,
      label: typeof record.label === 'string' ? record.label : undefined,
      roles,
    })
  }
  return steps
}

function coerceHero(value: unknown): { title?: string; body?: string } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title : undefined
  const body = typeof record.body === 'string' ? record.body : undefined
  if (!title && !body) return null
  return { title, body }
}

function coerceFeatureFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function coerceCustomer(value: Prisma.JsonValue | null | undefined): StorefrontDraftSnapshot['customer'] {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const coerce = (val: unknown) => (typeof val === 'string' && val.trim() ? val : null)
  return {
    name: coerce(record.name),
    email: coerce(record.email),
    phone: coerce(record.phone),
  }
}

function coerceValidation(value: unknown): StorefrontValidationSnapshot | null {
  if (!value || typeof value !== 'object') return null
  return normalizeValidationSnapshot(value as StorefrontValidationSnapshot | null | undefined)
}
