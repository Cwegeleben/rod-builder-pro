import crypto from 'node:crypto'
import { DesignBuildStatus, type DesignBuild, type DesignBuildDraft, Prisma } from '@prisma/client'
import { prisma } from '../../db.server'

// <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 -->
// Legacy storefront drafts currently live in app/services/designStudio/storefrontDraft.server.ts (loadDesignStorefrontDraft/saveDesignStorefrontDraft)
// and hydrate Shopify tenants via DesignStorefrontDraft rows. This repository mirrors those inputs/outputs using
// the canonical DesignBuild + DesignBuildDraft tables; routes will switch over in a later Phase C step.

const ACTIVE_DRAFT_STATUS = 'active'

export type DraftWithBuild = (DesignBuildDraft & { build: DesignBuild }) | null

export type CreateInitialBuildAndDraftParams = {
  tenantId: string
  userId: string
  initialPayload: Prisma.InputJsonValue
  roleSelections?: Prisma.InputJsonValue | null
  compatContext?: Prisma.InputJsonValue | null
  validationSnapshot?: Prisma.InputJsonValue | null
  telemetryVersion?: string | null
  notes?: string | null
  legacyBuildId?: string | null
  shopDomain?: string | null
}

export async function getLatestDraftForTenantAndUser(tenantId: string, userId: string): Promise<DraftWithBuild> {
  return prisma.designBuildDraft.findFirst({
    where: {
      tenantId,
      createdByUserId: userId,
      status: ACTIVE_DRAFT_STATUS,
      build: { tenantId, createdByUserId: userId },
    },
    orderBy: { lastTouchedAt: 'desc' },
    include: { build: true },
  })
}

export async function createInitialBuildAndDraft(
  params: CreateInitialBuildAndDraftParams,
): Promise<{ build: DesignBuild; draft: DesignBuildDraft }> {
  const { tenantId, userId, initialPayload, telemetryVersion, notes, legacyBuildId } = params
  const roleSelections = (params.roleSelections ?? Prisma.JsonNull) as Prisma.InputJsonValue
  const compatContext = (params.compatContext ?? Prisma.JsonNull) as Prisma.InputJsonValue
  const validationSnapshot = (params.validationSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue
  const shopDomain = params.shopDomain ?? 'draft-placeholder.shop'
  const reference = `DRAFT-${crypto.randomUUID()}`

  const build = await prisma.designBuild.create({
    data: {
      reference,
      shopDomain,
      tenantId,
      createdByUserId: userId,
      status: DesignBuildStatus.DRAFT,
      roleSelections,
      compatContext,
      validationSnapshot,
      telemetryVersion,
      notes,
      legacyBuildId,
    },
  })

  const draft = await prisma.designBuildDraft.create({
    data: {
      buildId: build.id,
      tenantId,
      createdByUserId: userId,
      version: 1,
      draftPayload: initialPayload,
      compatContext,
      validationSnapshot,
      status: ACTIVE_DRAFT_STATUS,
    },
  })

  const updatedBuild = await prisma.designBuild.update({
    where: { id: build.id },
    data: { latestDraftId: draft.id },
  })

  return { build: updatedBuild, draft }
}

export type UpdateDraftInput = {
  draftPayload?: Prisma.InputJsonValue
  compatContext?: Prisma.InputJsonValue | null
  validationSnapshot?: Prisma.InputJsonValue | null
  status?: string
  expiresAt?: Date | null
}

export async function updateDraft(draftId: string, updates: UpdateDraftInput): Promise<DesignBuildDraft> {
  // Versioning stays fixed per draft record until we introduce multi-version history.
  const next: Prisma.DesignBuildDraftUncheckedUpdateInput = {
    lastTouchedAt: new Date(),
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'draftPayload')) {
    next.draftPayload = (updates.draftPayload ?? Prisma.JsonNull) as Prisma.InputJsonValue
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'compatContext')) {
    next.compatContext = (updates.compatContext ?? Prisma.JsonNull) as Prisma.InputJsonValue
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'validationSnapshot')) {
    next.validationSnapshot = (updates.validationSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue
  }
  if (typeof updates.status === 'string') {
    next.status = updates.status
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'expiresAt')) {
    next.expiresAt = updates.expiresAt ?? null
  }

  const draft = await prisma.designBuildDraft.update({ where: { id: draftId }, data: next })
  await prisma.designBuild.update({ where: { id: draft.buildId }, data: { latestDraftId: draft.id } })
  return draft
}

export async function touchDraft(draftId: string): Promise<DesignBuildDraft> {
  const draft = await prisma.designBuildDraft.update({
    where: { id: draftId },
    data: { lastTouchedAt: new Date() },
  })
  await prisma.designBuild.update({ where: { id: draft.buildId }, data: { latestDraftId: draft.id } })
  return draft
}
// <!-- END RBP GENERATED: design-studio-phase-c-v1 -->
