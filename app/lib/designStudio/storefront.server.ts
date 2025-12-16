import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import type { DesignStudioAccess } from './access.server'
import type { DesignStudioWizardStep } from './tenantSeeds'
import {
  getMockDesignStorefrontOptions,
  getMockDesignStorefrontConfig,
  type DesignStorefrontConfig,
  type DesignStorefrontOption,
  type DesignStorefrontPartRole,
  type DesignStorefrontStep,
} from './storefront.mock'
import {
  augmentCompatibilityFromAttributes,
  filterOptionsByCompatibility,
  normalizeDesignStudioCompatibility,
  type DesignStorefrontCompatibilityContext,
  type CompatibilityIssue,
  describeCompatibilityIssue,
} from './compatibility'
import { logDesignStudioValidationEvent } from './validation'

const PRODUCT_DB_ENABLED = process.env.PRODUCT_DB_ENABLED === '1'
const BLANK_DRAFTS_ENABLED = process.env.DESIGN_STUDIO_DRAFTS_V1 === '1'
const REEL_SEAT_PHASE3_ENABLED = process.env.DESIGN_STUDIO_PHASE3_REEL_SEAT === '1'
const DEFAULT_BASE_PRICE = Number(process.env.DESIGN_STOREFRONT_BASE_PRICE ?? 250)
const DEFAULT_ROLE_ORDER: DesignStorefrontPartRole[] = [
  'blank',
  'handle',
  'reel_seat',
  'guide_set',
  'guide_tip',
  'component',
  'accessory',
]
const DEFAULT_WIZARD_STEPS: DesignStudioWizardStep[] = ['blank', 'components']
const ROLE_LABELS: Record<string, string> = {
  blank: 'Blank',
  handle: 'Handle',
  reel_seat: 'Reel seat',
  guide_set: 'Guide set',
  guide: 'Guide',
  guide_tip: 'Tip top',
  component: 'Component',
  accessory: 'Accessory',
}
const ROLE_ALIASES: Record<string, DesignStorefrontPartRole> = {
  blank: 'blank',
  handle: 'handle',
  handles: 'handle',
  grip: 'handle',
  grips: 'handle',
  rear_grip: 'handle',
  fore_grip: 'handle',
  reel_seat: 'reel_seat',
  seat: 'reel_seat',
  guide_set: 'guide_set',
  guides: 'guide_set',
  guide: 'guide',
  tip: 'guide_tip',
  tip_top: 'guide_tip',
  guide_tip: 'guide_tip',
  accessory: 'accessory',
  accessories: 'accessory',
  component: 'component',
  components: 'component',
}
const ROLE_SET = new Set<DesignStorefrontPartRole>([
  'blank',
  'rear_grip',
  'fore_grip',
  'reel_seat',
  'butt_cap',
  'guide_set',
  'guide',
  'guide_tip',
  'tip_top',
  'winding_check',
  'decal',
  'handle',
  'component',
  'accessory',
])
// Removed unused ROLE_SET constant
const DEFAULT_HERO = {
  title: 'Design your Rainshadow build',
  body: 'Work through curated steps to assemble blanks, components, and finishing touches tailored to your tier.',
}
const STEP_DESCRIPTION: Partial<Record<DesignStudioWizardStep, string>> = {
  blank: 'Pick the performance backbone for your build.',
  components: 'Dial in handle systems, guide trains, and accessories.',
}

export function isDesignStorefrontPartRole(value: unknown): value is DesignStorefrontPartRole {
  return typeof value === 'string' && ROLE_SET.has(value as DesignStorefrontPartRole)
}

type TenantConfigShape = {
  wizardSteps: DesignStudioWizardStep[]
  componentRoles: DesignStorefrontPartRole[]
  featureFlags: string[]
  copy: { heroTitle: string; heroBody: string }
  basePrice?: number
}

type LoadOptionsArgs = {
  access: DesignStudioAccess
  role: DesignStorefrontPartRole | null
  take?: number
  compatibilityContext?: DesignStorefrontCompatibilityContext | null
}

export type LoadDesignStorefrontOptionsResult = {
  options: DesignStorefrontOption[]
  issues: CompatibilityIssue[]
}

type ProductPayload = Prisma.ProductGetPayload<{
  select: {
    id: true
    productCode: true
    title: true
    designStudioReady: true
    designStudioFamily: true
    designStudioCoverageNotes: true
    attributes: true
    supplier: { select: { name: true } }
    latestVersion: {
      select: {
        designStudioRole: true
        designStudioSeries: true
        designStudioCompatibility: true
        priceMsrp: true
        priceWholesale: true
        images: true
        description: true
      }
    }
  }
}>

export async function loadDesignStorefrontConfig(access: DesignStudioAccess): Promise<DesignStorefrontConfig> {
  if (!access.enabled) {
    throw new Error('Design Studio disabled for this shop')
  }
  const tenantConfig = normalizeTenantConfig(access.config)
  const steps = buildSteps(tenantConfig.wizardSteps, tenantConfig.componentRoles)
  const resolvedConfig: DesignStorefrontConfig = {
    hero: resolveHeroCopy(tenantConfig.copy),
    tier: access.tier,
    currency: 'USD',
    basePrice: tenantConfig.basePrice ?? DEFAULT_BASE_PRICE,
    featureFlags: tenantConfig.featureFlags,
    steps,
  }

  if (!PRODUCT_DB_ENABLED) {
    const mock = await getMockDesignStorefrontConfig()
    const featureFlags = resolvedConfig.featureFlags.length ? resolvedConfig.featureFlags : mock.featureFlags
    return { ...mock, ...resolvedConfig, featureFlags }
  }

  return resolvedConfig
}

export async function loadDesignStorefrontOptions({
  access,
  role,
  take = 24,
  compatibilityContext,
}: LoadOptionsArgs): Promise<LoadDesignStorefrontOptionsResult> {
  if (!access.enabled || !role) {
    return { options: [], issues: [] }
  }
  if (!PRODUCT_DB_ENABLED) {
    return { options: await loadMockOptions(role), issues: [] }
  }

  const queryRoles = resolveQueryRoles(role)
  if (!queryRoles.length) {
    logStorefrontOptionsTelemetry('no-query-roles', {
      access,
      role,
      reasoning: 'alias-resolution-empty',
    })
    return { options: [], issues: [] }
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        designStudioReady: true,
        latestVersion: {
          designStudioRole: { in: queryRoles },
        },
      },
      orderBy: [{ designStudioFamily: 'asc' }, { designStudioLastTouchedAt: 'desc' }],
      take,
      select: {
        id: true,
        productCode: true,
        title: true,
        designStudioReady: true,
        designStudioFamily: true,
        designStudioCoverageNotes: true,
        attributes: true,
        supplier: { select: { name: true } },
        latestVersion: {
          select: {
            designStudioRole: true,
            designStudioSeries: true,
            designStudioCompatibility: true,
            priceMsrp: true,
            priceWholesale: true,
            images: true,
            description: true,
          },
        },
      },
    })

    if (!products.length) {
      logStorefrontOptionsTelemetry('zero-results', {
        access,
        role,
        queryRoles,
        take,
        reasoning: 'no-products-returned',
      })
      if (shouldFallbackToMockOptions(role)) {
        console.warn(`[designStudio] Falling back to mock options for ${role} role`)
        return { options: await loadMockOptions(role), issues: [] }
      }
      return { options: [], issues: [] }
    }

    const mapped = products
      .map(product => mapProductToOption(product, role))
      .filter((option): option is DesignStorefrontOption => option !== null)

    if (!mapped.length) {
      logStorefrontOptionsTelemetry('zero-results', {
        access,
        role,
        queryRoles,
        take,
        reasoning: 'mapped-filtered-out',
      })
      return { options: [], issues: [] }
    }
    if (!compatibilityContext || role === 'blank') {
      return { options: mapped, issues: [] }
    }
    const { allowed, rejected, issues } = filterOptionsByCompatibility(mapped, role, compatibilityContext)
    if (rejected.length) {
      logStorefrontOptionsTelemetry('compatibility-filter', {
        access,
        role,
        queryRoles,
        take,
        reasoning: JSON.stringify(rejected.slice(0, 5)),
      })
      rejected.forEach(entry => {
        const hasMissingData = entry.issues.some(
          issue => issue.code === 'missing-option' || issue.code === 'missing-measurement',
        )
        const eventCode = hasMissingData ? 'missing-compatibility-data' : 'incompatible-selection'
        logDesignStudioValidationEvent({
          type: eventCode,
          code: eventCode,
          role,
          optionId: entry.optionId,
          productId: entry.productId ?? undefined,
          shopDomain: access.shopDomain ?? undefined,
          metadata: { issues: entry.issues.map(describeCompatibilityIssue) },
        })
      })
    }
    if (issues.length) {
      issues.forEach(issue => {
        if (issue.code === 'no-compatible-options') {
          logDesignStudioValidationEvent({
            type: 'zero-compatible-options',
            code: 'zero-compatible-options',
            role: issue.role,
            shopDomain: access.shopDomain ?? undefined,
          })
        }
      })
    }
    return { options: allowed, issues }
  } catch (error) {
    console.warn('[designStudio] Failed to load storefront options', error)
    logStorefrontOptionsTelemetry('load-error', {
      access,
      role,
      queryRoles,
      take,
      reasoning: error instanceof Error ? error.message : 'unknown-error',
    })
    return { options: [], issues: [] }
  }
}

function normalizeTenantConfig(raw: unknown): TenantConfigShape {
  const record = asRecord(raw)
  const wizardSteps = Array.isArray(record?.wizardSteps)
    ? record.wizardSteps.map(step => (typeof step === 'string' ? step : '')).filter(isWizardStep)
    : DEFAULT_WIZARD_STEPS

  const componentRoles = extractComponentRoles(record?.componentRoles)
  const featureFlags = extractFeatureFlags(record?.featureFlags)
  const copy = resolveCopy(record?.copy)
  const basePrice = resolveBasePrice(record)
  return { wizardSteps, componentRoles, featureFlags, copy, basePrice }
}

function extractComponentRoles(raw: unknown): DesignStorefrontPartRole[] {
  if (!Array.isArray(raw)) return DEFAULT_ROLE_ORDER
  const seen = new Set<DesignStorefrontPartRole>()
  const roles: DesignStorefrontPartRole[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const roleValue = (entry as { role?: string | null }).role
    const normalized = normalizeRole(roleValue)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      roles.push(normalized)
    }
  }
  if (!roles.includes('blank')) {
    roles.unshift('blank')
  }
  return roles.length ? roles : DEFAULT_ROLE_ORDER
}

function extractFeatureFlags(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const flags: string[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (value) flags.push(key)
  }
  return flags
}

function resolveCopy(raw: unknown): { heroTitle: string; heroBody: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { heroTitle: DEFAULT_HERO.title, heroBody: DEFAULT_HERO.body }
  }
  const copy = raw as Record<string, unknown>
  const title = typeof copy.heroTitle === 'string' && copy.heroTitle.trim() ? copy.heroTitle : DEFAULT_HERO.title
  const body = typeof copy.heroBody === 'string' && copy.heroBody.trim() ? copy.heroBody : DEFAULT_HERO.body
  return { heroTitle: title, heroBody: body }
}

function resolveBasePrice(raw: Record<string, unknown> | null): number | undefined {
  if (!raw) return undefined
  const pricing = raw.pricing
  if (pricing && typeof pricing === 'object' && !Array.isArray(pricing)) {
    const candidate = Number((pricing as Record<string, unknown>).basePrice)
    if (Number.isFinite(candidate) && candidate > 0) return candidate
  }
  const fallback = Number(raw.basePrice)
  return Number.isFinite(fallback) && fallback > 0 ? fallback : undefined
}

function buildSteps(
  wizardSteps: DesignStudioWizardStep[],
  roleOrder: DesignStorefrontPartRole[],
): DesignStorefrontStep[] {
  const groups = wizardSteps
    .map(step => ({ step, roles: rolesForWizardStep(step, roleOrder) }))
    .filter(group => group.roles.length)

  if (!groups.length) {
    return roleOrder.map((role, index) => ({
      id: `step-${index + 1}-${role}`,
      label: `Step ${index + 1} · ${ROLE_LABELS[role] ?? role}`,
      roles: [role],
    }))
  }

  let stepNumber = 1
  return groups.map(group => ({
    id: `step-${group.step}`,
    label: `Step ${stepNumber++} · ${formatWizardLabel(group.step)}`,
    description: STEP_DESCRIPTION[group.step],
    roles: group.roles,
  }))
}

function rolesForWizardStep(
  step: DesignStudioWizardStep,
  roleOrder: DesignStorefrontPartRole[],
): DesignStorefrontPartRole[] {
  switch (step) {
    case 'blank':
      return roleOrder.filter(role => role === 'blank')
    case 'components':
      return roleOrder.filter(role => role !== 'blank')
    default:
      return []
  }
}

function formatWizardLabel(step: DesignStudioWizardStep): string {
  switch (step) {
    case 'blank':
      return 'Blank'
    case 'components':
      return 'Components'
    case 'baseline':
      return 'Baseline'
    case 'review':
      return 'Review'
    default:
      return step
  }
}

function mapProductToOption(product: ProductPayload, asRole: DesignStorefrontPartRole): DesignStorefrontOption | null {
  const version = product.latestVersion
  if (!version) return null
  const compatibility = augmentCompatibilityFromAttributes({
    role: asRole,
    base: normalizeDesignStudioCompatibility(version.designStudioCompatibility),
    attributes: product.attributes ?? null,
  })
  const specs = buildSpecs(compatibility)
  return {
    id: product.id,
    productId: product.id,
    role: asRole,
    title: product.title,
    vendor: product.supplier?.name ?? undefined,
    sku: product.productCode,
    subtitle: buildSubtitle(compatibility),
    notes: product.designStudioCoverageNotes ?? undefined,
    price: resolvePrice(version),
    specs,
    imageUrl: extractImageUrl(version.images) ?? undefined,
    badge: product.designStudioFamily ?? undefined,
    family: product.designStudioFamily ?? undefined,
    ready: product.designStudioReady ?? null,
    compatibility,
  }
}

function buildSpecs(compatibility: CompatibilityRecord) {
  const specs: Array<{ label: string; value: string }> = []
  if (compatibility.lengthIn) specs.push({ label: 'Length', value: formatLength(compatibility.lengthIn) })
  if (compatibility.power) specs.push({ label: 'Power', value: compatibility.power })
  if (compatibility.action) specs.push({ label: 'Action', value: compatibility.action })
  if (compatibility.finish) specs.push({ label: 'Finish', value: compatibility.finish })
  if (compatibility.rodPieces) specs.push({ label: 'Pieces', value: String(compatibility.rodPieces) })
  return specs
}

function buildSubtitle(compatibility: CompatibilityRecord): string | undefined {
  const parts = [
    compatibility.power,
    compatibility.action,
    compatibility.lengthIn ? formatLength(compatibility.lengthIn) : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

function resolvePrice(version: ProductPayload['latestVersion']): number {
  const value = version?.priceMsrp ?? version?.priceWholesale ?? 0
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
}

function extractImageUrl(value: Prisma.JsonValue | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length) {
    const first = value[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      const record = first as Record<string, unknown>
      if (typeof record.url === 'string') return record.url
      if (typeof record.src === 'string') return record.src
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.url === 'string') return record.url
    if (typeof record.src === 'string') return record.src
  }
  return null
}

type CompatibilityRecord = ReturnType<typeof normalizeDesignStudioCompatibility>

function formatLength(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return `${value} in`
  const feet = Math.floor(value / 12)
  const inches = Math.round(value % 12)
  if (feet <= 0) return `${inches}"`
  return `${feet}'${inches}"`
}

function rolesForAlias(role: DesignStorefrontPartRole): string[] {
  if (role === 'accessory') return ['accessory', 'component']
  if (role === 'rear_grip' || role === 'fore_grip') return ['handle']
  if (role === 'butt_cap') return ['butt_cap', 'handle']
  if (role === 'tip_top') return ['guide_tip']
  if (role === 'winding_check' || role === 'decal') return ['accessory', 'component']
  if (role === 'handle') return ['handle']
  if (role === 'component') return ['component']
  return [role]
}

function resolveQueryRoles(role: DesignStorefrontPartRole): string[] {
  return Array.from(new Set(rolesForAlias(role)))
}

async function loadMockOptions(role: DesignStorefrontPartRole): Promise<DesignStorefrontOption[]> {
  switch (role) {
    case 'handle': {
      const variants = await Promise.all([
        getMockDesignStorefrontOptions('rear_grip'),
        getMockDesignStorefrontOptions('fore_grip'),
        getMockDesignStorefrontOptions('reel_seat'),
        getMockDesignStorefrontOptions('butt_cap'),
      ])
      return variants.flat().map(option => ({ ...option, role }))
    }
    case 'accessory': {
      const variants = await Promise.all([
        getMockDesignStorefrontOptions('winding_check'),
        getMockDesignStorefrontOptions('decal'),
      ])
      return variants.flat().map(option => ({ ...option, role }))
    }
    case 'guide_tip': {
      const options = await getMockDesignStorefrontOptions('tip_top')
      return options.map(option => ({ ...option, role }))
    }
    default:
      return getMockDesignStorefrontOptions(role)
  }
}

function shouldFallbackToMockOptions(role: DesignStorefrontPartRole): boolean {
  if (role === 'blank') {
    return BLANK_DRAFTS_ENABLED
  }
  if (role === 'reel_seat') {
    return BLANK_DRAFTS_ENABLED && REEL_SEAT_PHASE3_ENABLED
  }
  return false
}

function normalizeRole(value: string | null | undefined): DesignStorefrontPartRole | null {
  if (!value) return null
  const key = value.toLowerCase()
  return ROLE_ALIASES[key] ?? (ROLE_SET.has(key as DesignStorefrontPartRole) ? (key as DesignStorefrontPartRole) : null)
}

function isWizardStep(value: string): value is DesignStudioWizardStep {
  return value === 'baseline' || value === 'blank' || value === 'components' || value === 'review'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function resolveHeroCopy(copy: { heroTitle: string; heroBody: string }): DesignStorefrontConfig['hero'] {
  return { title: copy.heroTitle || DEFAULT_HERO.title, body: copy.heroBody || DEFAULT_HERO.body }
}

type StorefrontOptionsTelemetryEvent = 'no-query-roles' | 'zero-results' | 'load-error' | 'compatibility-filter'

function logStorefrontOptionsTelemetry(
  event: StorefrontOptionsTelemetryEvent,
  {
    access,
    role,
    queryRoles,
    take,
    reasoning,
  }: {
    access: DesignStudioAccess
    role: DesignStorefrontPartRole
    queryRoles?: string[]
    take?: number
    reasoning?: string
  },
) {
  try {
    console.warn(
      JSON.stringify({
        telemetry: 'designStudio.storefront.options',
        event,
        role,
        tier: access.tier,
        shopDomain: access.shopDomain,
        queryRoles,
        take,
        reasoning,
      }),
    )
  } catch (err) {
    console.warn('[designStudio] Failed to emit storefront options telemetry', { event, role, err })
  }
}
