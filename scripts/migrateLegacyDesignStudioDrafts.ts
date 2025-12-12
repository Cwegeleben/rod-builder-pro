/* <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 --> */
import { Prisma } from '@prisma/client'
import type { DesignStorefrontDraft, DesignStorefrontDraftStatus } from '@prisma/client'
import type { DesignStudioValidationSeverity } from '../app/lib/designStudio/validation'
import { prisma } from '../app/db.server'
import { createInitialBuildAndDraft } from '../app/services/designStudio/designBuildDraftRepo.server'
import { isDesignStorefrontPartRole } from '../app/lib/designStudio/storefront.server'
import type { DesignStorefrontPartRole } from '../app/lib/designStudio/storefront.mock'
import type {
  StorefrontSelectionSnapshot,
  StorefrontSummarySnapshot,
  StorefrontStepSnapshot,
  StorefrontValidationSnapshot,
} from '../app/services/designStudio/storefrontPayload.server'
import type { StorefrontDraftSnapshot } from '../app/services/designStudio/storefrontDraft.server'

const BATCH_SIZE = Math.max(Number(process.env.BATCH_SIZE ?? '100'), 10)
const tenantCache = new Map<string, string>()

const stats = {
  legacyDraftsScanned: 0,
  buildsCreated: 0,
  draftsCreated: 0,
  draftsSkipped: 0,
}

type LegacyDraftRow = Pick<
  DesignStorefrontDraft,
  | 'id'
  | 'token'
  | 'shopDomain'
  | 'tier'
  | 'status'
  | 'selections'
  | 'summary'
  | 'customer'
  | 'metadata'
  | 'notes'
  | 'expiresAt'
  | 'createdAt'
  | 'updatedAt'
>

type TenantContext = { tenantId: string; userId: string; shopDomain: string }

type DraftPriming = {
  payload: StorefrontDraftSnapshot
  roleSelections: Prisma.InputJsonValue
  validationSnapshot: Prisma.InputJsonValue
  status: string
}

type BuildContext = TenantContext & { legacyBuildId: string }

async function main() {
  try {
    await migrateLegacyDrafts()
    console.log('Legacy drafts scanned:', stats.legacyDraftsScanned)
    console.log('Builds created:', stats.buildsCreated)
    console.log('Drafts created:', stats.draftsCreated)
    console.log('Drafts skipped:', stats.draftsSkipped)
  } catch (error) {
    console.error('migrateLegacyDesignStudioDrafts failed', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

async function migrateLegacyDrafts() {
  let cursor: string | null = null
  for (;;) {
    const batch = (await prisma.designStorefrontDraft.findMany({
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        token: true,
        shopDomain: true,
        tier: true,
        status: true,
        selections: true,
        summary: true,
        customer: true,
        metadata: true,
        notes: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as LegacyDraftRow[]
    if (!batch.length) {
      break
    }
    cursor = batch[batch.length - 1].id
    stats.legacyDraftsScanned += batch.length
    await primeTenantCache(batch.map(row => row.shopDomain))
    const groups = groupByContext(batch)
    for (const groupRows of groups.values()) {
      await migrateGroup(groupRows)
    }
  }
}

function groupByContext(rows: LegacyDraftRow[]) {
  const groups = new Map<string, { context: BuildContext; rows: LegacyDraftRow[] }>()
  for (const row of rows) {
    const context = getBuildContext(row.shopDomain)
    const key = `${context.tenantId}::${context.userId}`
    const existing = groups.get(key)
    if (existing) {
      existing.rows.push(row)
    } else {
      groups.set(key, { context, rows: [row] })
    }
  }
  return groups
}

async function migrateGroup(group: { context: BuildContext; rows: LegacyDraftRow[] }) {
  const sorted = [...group.rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  let build = await prisma.designBuild.findFirst({ where: { legacyBuildId: group.context.legacyBuildId } })
  if (!build && sorted.length) {
    const firstRow = sorted.shift()!
    const primed = primeDraftFields(firstRow)
    const { build: createdBuild, draft } = await createInitialBuildAndDraft({
      tenantId: group.context.tenantId,
      userId: group.context.userId,
      shopDomain: group.context.shopDomain,
      initialPayload: primed.payload as Prisma.InputJsonValue,
      roleSelections: primed.roleSelections,
      compatContext: null,
      validationSnapshot: primed.validationSnapshot,
      notes: coerceNote(firstRow.notes),
      legacyBuildId: group.context.legacyBuildId,
    })
    await prisma.designBuild.update({
      where: { id: createdBuild.id },
      data: { tier: firstRow.tier, latestDraftId: draft.id },
    })
    await prisma.designBuildDraft.update({
      where: { id: draft.id },
      data: {
        importedFromExternalId: firstRow.id,
        status: primed.status,
        expiresAt: firstRow.expiresAt,
        lastTouchedAt: firstRow.updatedAt,
        compatContext: Prisma.JsonNull,
        validationSnapshot: primed.validationSnapshot,
        draftPayload: primed.payload as Prisma.InputJsonValue,
      },
    })
    stats.buildsCreated += 1
    stats.draftsCreated += 1
    build = await prisma.designBuild.findUnique({ where: { id: createdBuild.id } })
  }
  if (!build) {
    return
  }
  const existingDrafts = await prisma.designBuildDraft.findMany({
    where: { buildId: build.id },
    select: { id: true, version: true, importedFromExternalId: true },
    orderBy: { version: 'asc' },
  })
  const importedKeys = new Set(existingDrafts.map(entry => entry.importedFromExternalId).filter(Boolean) as string[])
  let nextVersion = existingDrafts.length ? Math.max(...existingDrafts.map(entry => entry.version)) + 1 : 1
  let latestDraftId = existingDrafts.length
    ? existingDrafts[existingDrafts.length - 1].id
    : (build.latestDraftId ?? null)
  for (const row of sorted) {
    if (importedKeys.has(row.id)) {
      stats.draftsSkipped += 1
      continue
    }
    const primed = primeDraftFields(row)
    const draft = await prisma.designBuildDraft.create({
      data: {
        buildId: build.id,
        tenantId: group.context.tenantId,
        createdByUserId: group.context.userId,
        version: nextVersion,
        draftPayload: primed.payload as Prisma.InputJsonValue,
        compatContext: Prisma.JsonNull,
        validationSnapshot: primed.validationSnapshot,
        status: primed.status,
        importedFromExternalId: row.id,
        expiresAt: row.expiresAt,
        lastTouchedAt: row.updatedAt,
      },
    })
    stats.draftsCreated += 1
    importedKeys.add(row.id)
    latestDraftId = draft.id
    nextVersion += 1
  }
  const finalLatestId = latestDraftId ?? (existingDrafts.length ? existingDrafts[existingDrafts.length - 1].id : null)
  if (finalLatestId && build.latestDraftId !== finalLatestId) {
    await prisma.designBuild.update({ where: { id: build.id }, data: { latestDraftId: finalLatestId } })
  }
}

async function primeTenantCache(domains: string[]) {
  const normalized = domains.map(domain => domain.trim().toLowerCase()).filter(Boolean)
  const missing = Array.from(new Set(normalized.filter(domain => !tenantCache.has(domain))))
  if (!missing.length) return
  const uniqueOriginals = Array.from(new Set(domains))
  const tenants = await prisma.tenantSettings.findMany({
    where: { shopDomain: { in: uniqueOriginals } },
    select: { id: true, shopDomain: true },
  })
  const found = new Map(tenants.map(entry => [entry.shopDomain.trim().toLowerCase(), entry.id]))
  for (const domain of missing) {
    tenantCache.set(domain, found.get(domain) ?? `shop:${domain}`)
  }
}

function getBuildContext(shopDomainRaw: string): BuildContext {
  const shopDomain = shopDomainRaw.trim().toLowerCase()
  const tenantId = tenantCache.get(shopDomain) ?? `shop:${shopDomain}`
  return {
    tenantId,
    userId: `${tenantId}:storefront`,
    shopDomain,
    legacyBuildId: `legacy-storefront:${tenantId}:${shopDomain}`,
  }
}

function primeDraftFields(row: LegacyDraftRow): DraftPriming {
  const payload = buildSnapshotFromLegacy(row)
  return {
    payload,
    roleSelections: buildRoleSelections(payload.selections),
    validationSnapshot: (payload.validation ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    status: mapDraftStatus(row.status),
  }
}

function buildSnapshotFromLegacy(row: LegacyDraftRow): StorefrontDraftSnapshot {
  const metadata = asRecord(row.metadata)
  return {
    selections: coerceSelections(row.selections),
    summary: coerceSummary(row.summary),
    steps: coerceSteps(metadata?.steps),
    hero: coerceHero(metadata?.hero),
    featureFlags: coerceFeatureFlags(metadata?.featureFlags),
    customer: coerceCustomer(row.customer),
    notes: coerceNote(row.notes),
    validation: coerceValidation(metadata?.validation),
  }
}

function buildRoleSelections(selections: StorefrontSelectionSnapshot[]): Prisma.InputJsonValue {
  const simplified = selections.map(entry => ({
    role: entry.role,
    option: {
      id: entry.option.id,
      title: entry.option.title,
      sku: entry.option.sku,
      price: entry.option.price,
      vendor: entry.option.vendor,
      notes: entry.option.notes,
      badge: entry.option.badge,
    },
  }))
  return simplified as Prisma.InputJsonValue
}

function mapDraftStatus(status: DesignStorefrontDraftStatus): string {
  if (status === 'SUBMITTED') return 'submitted'
  if (status === 'EXPIRED') return 'expired'
  return 'active'
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function coerceSelections(value: Prisma.JsonValue | null | undefined): StorefrontSelectionSnapshot[] {
  if (!Array.isArray(value)) return []
  const selections: StorefrontSelectionSnapshot[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const role = record.role as DesignStorefrontPartRole | undefined
    if (!isDesignStorefrontPartRole(role)) continue
    const optionValue = record.option
    if (!optionValue || typeof optionValue !== 'object') continue
    const option = optionValue as Record<string, unknown>
    const title = typeof option.title === 'string' ? option.title : ''
    const id = typeof option.id === 'string' ? option.id : ''
    if (!title || !id) continue
    selections.push({
      role,
      option: {
        id,
        title,
        price: typeof option.price === 'number' ? option.price : Number(option.price) || 0,
        sku: typeof option.sku === 'string' ? option.sku : null,
        vendor: typeof option.vendor === 'string' ? option.vendor : null,
        notes: typeof option.notes === 'string' ? option.notes : null,
        badge: typeof option.badge === 'string' ? option.badge : null,
        compatibility: null,
      },
    })
  }
  return selections
}

function coerceSummary(value: Prisma.JsonValue | null | undefined): StorefrontSummarySnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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

function coerceHero(value: unknown): StorefrontDraftSnapshot['hero'] {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title : undefined
  const body = typeof record.body === 'string' ? record.body : undefined
  if (!title && !body) return null
  return { title, body }
}

function coerceFeatureFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(flag => typeof flag === 'string' && flag.trim().length > 0) as string[]
}

function coerceCustomer(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name : undefined
  const email = typeof record.email === 'string' ? record.email : undefined
  const phone = typeof record.phone === 'string' ? record.phone : undefined
  if (!name && !email && !phone) return undefined
  return { name, email, phone }
}

function coerceNote(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function coerceValidation(value: unknown): StorefrontValidationSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.entries)) return null
  const entries = record.entries
    .map(entry => (typeof entry === 'object' && entry ? (entry as Record<string, unknown>) : null))
    .filter((entry): entry is Record<string, unknown> => !!entry)
    .map(entry => ({
      panelId: typeof entry.panelId === 'string' ? entry.panelId : 'design-studio',
      severity: toValidationSeverity(entry.severity),
      code: typeof entry.code === 'string' ? entry.code : 'unknown',
      message: typeof entry.message === 'string' ? entry.message : 'Compatibility issue detected.',
    }))
  if (!entries.length) return null
  return {
    entries,
    hasCompatibilityIssues: (record.hasCompatibilityIssues as boolean | undefined) ?? entries.length > 0,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  }
}

function toValidationSeverity(value: unknown): DesignStudioValidationSeverity {
  if (value === 'info' || value === 'warning' || value === 'error') return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized === 'info' || normalized === 'warning' || normalized === 'error') {
      return normalized
    }
  }
  return 'warning'
}

void main()
/* <!-- END RBP GENERATED: design-studio-phase-c-v1 --> */
