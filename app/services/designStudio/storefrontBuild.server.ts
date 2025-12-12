import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { DesignBuildEventType, DesignFulfillmentMode } from '@prisma/client'
import { prisma } from '../../db.server'
import type { DesignStudioAccess } from '../../lib/designStudio/access.server'
import { isDesignStorefrontPartRole } from '../../lib/designStudio/storefront.server'
import {
  normalizeEmail,
  normalizeStorefrontPayload,
  truncate,
  type NormalizedSelection,
  type NormalizedStorefrontPayload,
  type StorefrontBuildPayload,
} from './storefrontPayload.server'
import { linkDraftToBuild } from './storefrontDraft.server'

export type CreateStorefrontBuildResult = {
  id: string
  reference: string
}

export async function createDesignStorefrontBuild({
  access,
  payload,
  draftToken,
}: {
  access: DesignStudioAccess
  payload: StorefrontBuildPayload
  draftToken?: string | null
}): Promise<CreateStorefrontBuildResult> {
  if (!access.enabled) {
    throw new Error('Design Studio access disabled for shop')
  }
  if (!access.shopDomain) {
    throw new Error('Missing shop domain for Design Studio submission')
  }

  const normalized = normalizeStorefrontPayload(payload)
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
    bomHash: hashSelections(normalized.selections),
    submittedAt: now,
  }

  if (normalized.notes != null) {
    baseCreate.notesJson = normalized.notes
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

  if (draftToken) {
    await linkDraftToBuild({
      draftToken,
      buildId: build.id,
      shopDomain: access.shopDomain,
    })
  }

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

function buildComponentSummary(payload: NormalizedStorefrontPayload) {
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

function buildMetadata(payload: NormalizedStorefrontPayload) {
  return {
    hero: payload.hero,
    summary: payload.summary,
    featureFlags: payload.featureFlags,
    steps: payload.steps?.map(step => ({
      id: step.id,
      label: step.label,
      roles: Array.isArray(step.roles) ? step.roles.filter(isDesignStorefrontPartRole) : [],
    })),
    validation: payload.validation,
  }
}

function hashSelections(selections: NormalizedSelection[]) {
  const digest = crypto.createHash('sha1').update(JSON.stringify(selections)).digest('hex')
  return digest
}

function isUniqueReferenceError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'
}
