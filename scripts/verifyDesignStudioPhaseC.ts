/* <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 --> */
import crypto from 'node:crypto'
import { DesignStudioTier } from '@prisma/client'
import { prisma } from '../app/db.server'
import type { DesignStudioAccess } from '../app/lib/designStudio/access.server'
import type { StorefrontBuildPayload } from '../app/services/designStudio/storefrontPayload.server'
import {
  loadDesignStorefrontDraft,
  saveDesignStorefrontDraft,
} from '../app/services/designStudio/storefrontDraft.server'

async function main() {
  try {
    await verifyPhaseC()
    console.log('verifyDesignStudioPhaseC: PASS')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('verifyDesignStudioPhaseC: FAIL', message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

async function verifyPhaseC() {
  const shopDomain = `phase-c-verify-${crypto.randomUUID().slice(0, 8)}.myshopify.com`
  const access: DesignStudioAccess = {
    enabled: true,
    tier: DesignStudioTier.PLUS,
    config: null,
    shopDomain,
    reason: 'enabled',
  }

  const initialPayload = buildPayload({ note: 'initial' })
  const initialSave = await saveDesignStorefrontDraft({ access, token: null, payload: initialPayload })
  if (!initialSave.token) {
    throw new Error('Initial save did not return a token')
  }
  const initialDraft = await prisma.designBuildDraft.findUnique({ where: { id: initialSave.token } })
  if (!initialDraft) {
    throw new Error('Initial draft record missing')
  }
  const initialTouchedAt = initialDraft.lastTouchedAt

  const updatedPayload = buildPayload({ note: 'updated', selectionOffset: 2 })
  const updatedSave = await saveDesignStorefrontDraft({ access, token: initialSave.token, payload: updatedPayload })
  if (!updatedSave.token) {
    throw new Error('Updated save did not return a token')
  }

  const refreshedDraft = await prisma.designBuildDraft.findUnique({ where: { id: updatedSave.token } })
  if (!refreshedDraft) {
    throw new Error('Updated draft record missing')
  }
  if (!refreshedDraft.lastTouchedAt || refreshedDraft.lastTouchedAt.getTime() === initialTouchedAt.getTime()) {
    throw new Error('lastTouchedAt did not change after update')
  }

  const build = await prisma.designBuild.findUnique({ where: { id: refreshedDraft.buildId } })
  if (!build) {
    throw new Error('DesignBuild missing for updated draft')
  }
  if (build.latestDraftId !== refreshedDraft.id) {
    throw new Error('latestDraftId is not aligned with the updated draft')
  }
  const draftCount = await prisma.designBuildDraft.count({ where: { buildId: build.id } })
  if (draftCount < 1) {
    throw new Error('DesignBuild has no drafts recorded')
  }
  if (!refreshedDraft.tenantId || !refreshedDraft.createdByUserId) {
    throw new Error('Draft is missing tenant context from repo path')
  }

  const loaded = await loadDesignStorefrontDraft({ access, token: updatedSave.token })
  if (!loaded.draft) {
    throw new Error('Load flow did not return a draft snapshot')
  }
  if (loaded.token !== updatedSave.token) {
    throw new Error('Load flow returned an unexpected token reference')
  }
}

type PayloadOptions = {
  note: string
  selectionOffset?: number
}

function buildPayload(options: PayloadOptions): StorefrontBuildPayload {
  const offset = options.selectionOffset ?? 1
  return {
    selections: [
      {
        role: 'blank',
        option: {
          id: `blank-${offset}`,
          title: `Heritage ${offset}`,
          price: 299 + offset,
          sku: `BLANK-${offset}`,
          vendor: 'Phase C QA',
        },
      },
      {
        role: 'reel_seat',
        option: {
          id: `seat-${offset}`,
          title: `Seat ${offset}`,
          price: 45 + offset,
          sku: `SEAT-${offset}`,
          vendor: 'Phase C QA',
        },
      },
    ],
    summary: {
      basePrice: 100 + offset,
      subtotal: 444 + offset,
      selectedParts: 2,
      totalParts: 6,
    },
    steps: [
      { id: 'blank-step', roles: ['blank'] },
      { id: 'seat-step', roles: ['reel_seat'] },
    ],
    hero: { title: 'Phase C Builder', body: 'Verification payload' },
    featureFlags: ['design-studio-phase-c'],
    customer: { name: 'Phase C QA', email: 'phasec@example.com', phone: '222-333-4444' },
    notes: `Phase C verification (${options.note})`,
    validation: {
      entries: [
        {
          panelId: 'phase-c',
          severity: 'info',
          code: 'phase_c_verify',
          message: 'Verification path exercised.',
        },
      ],
      hasCompatibilityIssues: false,
      updatedAt: new Date().toISOString(),
    },
  }
}

void main()
/* <!-- END RBP GENERATED: design-studio-phase-c-v1 --> */
