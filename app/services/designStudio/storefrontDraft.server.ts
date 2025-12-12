import type { DesignStorefrontDraft, Prisma } from '@prisma/client'
import { DesignStorefrontDraftStatus } from '@prisma/client'
import { prisma } from '../../db.server'
import type { DesignStudioAccess } from '../../lib/designStudio/access.server'
import { isDesignStorefrontPartRole } from '../../lib/designStudio/storefront.server'
import type { DesignStorefrontPartRole } from '../../lib/designStudio/storefront.mock'
import {
  normalizeStorefrontPayload,
  type NormalizedSelection,
  type NormalizedStorefrontPayload,
  type StorefrontBuildPayload,
  type StorefrontSelectionSnapshot,
  type StorefrontStepSnapshot,
  type StorefrontSummarySnapshot,
  type StorefrontValidationSnapshot,
  normalizeValidationSnapshot,
} from './storefrontPayload.server'
import {
  createInitialBuildAndDraft,
  getLatestDraftForTenantAndUser,
  touchDraft,
  updateDraft,
} from './designBuildDraftRepo.server'

const DRAFT_TTL_DAYS = Math.max(Number(process.env.DESIGN_STOREFRONT_DRAFT_TTL_DAYS || '14'), 1)
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000
type DraftRecord = DesignStorefrontDraft

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
// <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 -->
const ACTIVE_DRAFT_STATUS = 'active'
const INACTIVE_DRAFT_STATUS = 'inactive'
const SUBMITTED_DRAFT_STATUS = 'submitted'

type LoadDraftResult = { draft: StorefrontDraftSnapshot | null; token: string | null }
type TenantDraftContext = { tenantId: string; userId: string; shopDomain: string }

export async function loadDesignStorefrontDraft({
  access,
  token,
}: {
  access: DesignStudioAccess
  token: string | null | undefined
}): Promise<LoadDraftResult> {
  if (!access.enabled || !access.shopDomain) {
    return { draft: null, token: null }
  }
  const context = await resolveDraftContext(access)
  if (!context) {
    return { draft: null, token: null }
  }

  const repoDraft = await getLatestDraftForTenantAndUser(context.tenantId, context.userId)
  if (repoDraft) {
    if (isDraftExpired(repoDraft.expiresAt)) {
      await updateDraft(repoDraft.id, { status: 'expired' })
      return { draft: null, token: null }
    }
    if (repoDraft.status === ACTIVE_DRAFT_STATUS) {
      const snapshot = coerceRepoSnapshot(repoDraft.draftPayload)
      if (snapshot) {
        await touchDraft(repoDraft.id)
        return { draft: snapshot, token: repoDraft.id }
      }
    }
  }

  if (!token) {
    return { draft: null, token: null }
  }

  const legacyRecord = await loadLegacyDraftRecord(token, access.shopDomain)
  if (!legacyRecord) {
    return { draft: null, token: null }
  }

  const legacySnapshot = deserializeDraft(legacyRecord)
  const normalized = normalizeStorefrontPayload(snapshotToPayload(legacySnapshot), {
    requireSelections: false,
  })
  const migratedToken = await persistDraftToRepo({ context, normalized, existingToken: null })
  await expireLegacyDraft(token, access.shopDomain)
  return { draft: legacySnapshot, token: migratedToken }
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
  const context = await resolveDraftContext(access)
  if (!context) {
    throw new Error('Unable to resolve tenant context for Design Studio draft')
  }

  const normalized = normalizeStorefrontPayload(payload, { requireSelections: false })
  const nextTokenCandidate = token && !isLegacyDraftToken(token) ? token : null

  if (!normalized.selections.length) {
    if (nextTokenCandidate) {
      await updateDraft(nextTokenCandidate, { status: INACTIVE_DRAFT_STATUS })
    } else if (token) {
      await expireLegacyDraft(token, access.shopDomain)
    }
    return { token: null }
  }

  const repoToken = await persistDraftToRepo({
    context,
    normalized,
    existingToken: nextTokenCandidate,
  })

  if (token && isLegacyDraftToken(token)) {
    await expireLegacyDraft(token, access.shopDomain)
  }

  return { token: repoToken }
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
  if (!isLegacyDraftToken(draftToken)) {
    try {
      await updateDraft(draftToken, { status: SUBMITTED_DRAFT_STATUS })
    } catch (error) {
      console.warn('[designStudio] Unable to mark storefront draft submitted', { draftToken, error })
    }
    return
  }
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

async function resolveDraftContext(access: DesignStudioAccess): Promise<TenantDraftContext | null> {
  if (!access.shopDomain) return null
  const tenant = await prisma.tenantSettings.findUnique({ where: { shopDomain: access.shopDomain } })
  const tenantId = tenant?.id ?? `shop:${access.shopDomain}`
  return {
    tenantId,
    userId: `${tenantId}:storefront`,
    shopDomain: access.shopDomain,
  }
}

async function persistDraftToRepo({
  context,
  normalized,
  existingToken,
}: {
  context: TenantDraftContext
  normalized: NormalizedStorefrontPayload
  existingToken: string | null
}): Promise<string> {
  const snapshot = buildSnapshotFromNormalized(normalized)
  const payloadJson = snapshot as Prisma.InputJsonValue
  const validationJson = snapshot.validation ?? null
  const expiresAt = computeDraftExpiry()

  if (existingToken) {
    try {
      await updateDraft(existingToken, {
        draftPayload: payloadJson,
        compatContext: null,
        validationSnapshot: validationJson,
        status: ACTIVE_DRAFT_STATUS,
        expiresAt,
      })
      return existingToken
    } catch (error) {
      console.warn('[designStudio] Falling back to re-create storefront draft', { existingToken, error })
    }
  }

  const { draft } = await createInitialBuildAndDraft({
    tenantId: context.tenantId,
    userId: context.userId,
    shopDomain: context.shopDomain,
    initialPayload: payloadJson,
    roleSelections: buildRoleSelections(normalized.selections),
    compatContext: null,
    validationSnapshot: validationJson,
    notes: snapshot.notes ?? null,
  })
  await updateDraft(draft.id, { expiresAt })
  return draft.id
}

function buildSnapshotFromNormalized(normalized: NormalizedStorefrontPayload): StorefrontDraftSnapshot {
  return {
    selections: normalized.selections.map(selection => ({
      role: selection.role,
      option: {
        id: selection.option.id,
        title: selection.option.title,
        price: selection.option.price,
        sku: selection.option.sku,
        vendor: selection.option.vendor,
        notes: selection.option.notes,
        badge: selection.option.badge,
        compatibility: selection.option.compatibility ?? null,
      },
    })),
    summary: normalized.summary,
    steps: normalized.steps,
    hero: normalized.hero ?? null,
    featureFlags: normalized.featureFlags,
    customer: normalized.customer,
    notes: normalized.notes ?? null,
    validation: normalized.validation,
  }
}

function buildRoleSelections(selections: NormalizedSelection[]): Prisma.InputJsonValue {
  return selections.map(selection => ({
    role: selection.role,
    option: {
      id: selection.option.id,
      title: selection.option.title,
      sku: selection.option.sku,
      price: selection.option.price,
      vendor: selection.option.vendor,
      notes: selection.option.notes,
      badge: selection.option.badge,
    },
  })) as Prisma.InputJsonValue
}

function computeDraftExpiry() {
  return new Date(Date.now() + DRAFT_TTL_MS)
}

function isDraftExpired(value: Date | null | undefined) {
  return Boolean(value && value.getTime() < Date.now())
}

function coerceRepoSnapshot(value: Prisma.JsonValue | null | undefined): StorefrontDraftSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as StorefrontDraftSnapshot
  if (!Array.isArray(snapshot.selections) || !snapshot.summary) return null
  return snapshot
}

function isLegacyDraftToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && token.includes('-')
}

async function loadLegacyDraftRecord(token: string, shopDomain: string) {
  const draft = await prisma.designStorefrontDraft.findUnique({ where: { token } })
  if (!draft || draft.shopDomain !== shopDomain) return null
  if (draft.status !== DesignStorefrontDraftStatus.ACTIVE) return null
  if (draft.expiresAt && draft.expiresAt.getTime() < Date.now()) {
    await prisma.designStorefrontDraft.update({
      where: { id: draft.id },
      data: { status: DesignStorefrontDraftStatus.EXPIRED },
    })
    return null
  }
  return draft
}

async function expireLegacyDraft(token: string, shopDomain: string) {
  await prisma.designStorefrontDraft.updateMany({
    where: { token, shopDomain },
    data: { status: DesignStorefrontDraftStatus.EXPIRED },
  })
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

function snapshotToPayload(snapshot: StorefrontDraftSnapshot): StorefrontBuildPayload {
  return {
    selections: snapshot.selections,
    summary: snapshot.summary,
    steps: snapshot.steps,
    hero: snapshot.hero ?? undefined,
    featureFlags: snapshot.featureFlags,
    customer: snapshot.customer
      ? {
          name: snapshot.customer.name ?? undefined,
          email: snapshot.customer.email ?? undefined,
          phone: snapshot.customer.phone ?? undefined,
        }
      : undefined,
    notes: snapshot.notes ?? undefined,
    validation: snapshot.validation ?? undefined,
  }
}
// <!-- END RBP GENERATED: design-studio-phase-c-v1 -->

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
