import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignStorefrontDraftStatus } from '@prisma/client'
import type { DesignStudioAccess } from '../../../lib/designStudio/access.server'
import type { StorefrontBuildPayload } from '../storefrontPayload.server'

const mockRepo = vi.hoisted(() => ({
  createInitialBuildAndDraft: vi.fn(),
  getLatestDraftForTenantAndUser: vi.fn(),
  touchDraft: vi.fn(),
  updateDraft: vi.fn(),
}))

const mockPrisma = vi.hoisted(() => ({
  tenantSettings: {
    findUnique: vi.fn(),
  },
  designStorefrontDraft: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  designBuild: {
    update: vi.fn(),
  },
}))

vi.mock('../../../db.server', () => ({ prisma: mockPrisma }))
vi.mock('../designBuildDraftRepo.server', () => mockRepo)

describe('storefrontDraft.server', () => {
  const access: DesignStudioAccess = {
    enabled: true,
    shopDomain: 'tenant.myshopify.com',
    tier: 'PLUS',
    config: null,
    reason: 'enabled',
  }

  const samplePayload: StorefrontBuildPayload = {
    selections: [
      {
        role: 'blank',
        option: {
          id: 'opt-1',
          title: 'Sample option',
          price: 125,
        },
      },
    ],
    summary: { basePrice: 0, subtotal: 125, selectedParts: 1, totalParts: 1 },
    featureFlags: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.tenantSettings.findUnique.mockResolvedValue({ id: 'tenant-db' })
    mockRepo.getLatestDraftForTenantAndUser.mockResolvedValue(null)
    mockRepo.touchDraft.mockResolvedValue({})
  })

  it('persists a new draft via the repository when no token is provided', async () => {
    mockRepo.createInitialBuildAndDraft.mockResolvedValue({
      build: { id: 'build-1' },
      draft: { id: 'draftNew' },
    })
    mockRepo.updateDraft.mockResolvedValue({})

    const { saveDesignStorefrontDraft } = await import('../storefrontDraft.server')
    const result = await saveDesignStorefrontDraft({ access, token: null, payload: samplePayload })

    expect(result.token).toBe('draftNew')
    expect(mockRepo.createInitialBuildAndDraft).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-db', userId: 'tenant-db:storefront' }),
    )
    expect(mockRepo.updateDraft).toHaveBeenCalledWith(
      'draftNew',
      expect.objectContaining({ expiresAt: expect.any(Date) }),
    )
  })

  it('updates an existing repo-backed draft when token is provided', async () => {
    mockRepo.updateDraft.mockResolvedValue({})

    const { saveDesignStorefrontDraft } = await import('../storefrontDraft.server')
    const result = await saveDesignStorefrontDraft({ access, token: 'draftExisting', payload: samplePayload })

    expect(result.token).toBe('draftExisting')
    expect(mockRepo.updateDraft).toHaveBeenCalledWith(
      'draftExisting',
      expect.objectContaining({ draftPayload: expect.any(Object), status: 'active' }),
    )
    expect(mockRepo.createInitialBuildAndDraft).not.toHaveBeenCalled()
  })

  it('loads the latest repo draft snapshot and token', async () => {
    const snapshot = {
      selections: samplePayload.selections,
      summary: samplePayload.summary,
      steps: [],
      featureFlags: [],
    }
    mockRepo.getLatestDraftForTenantAndUser.mockResolvedValue({
      id: 'draft-loaded',
      status: 'active',
      draftPayload: snapshot,
      expiresAt: new Date(Date.now() + 1000),
      build: { id: 'build-draft' },
    })

    const { loadDesignStorefrontDraft } = await import('../storefrontDraft.server')
    const result = await loadDesignStorefrontDraft({ access, token: 'draft-loaded' })

    expect(result.token).toBe('draft-loaded')
    expect(result.draft?.summary.subtotal).toBe(125)
    expect(mockRepo.touchDraft).toHaveBeenCalledWith('draft-loaded')
  })

  it('falls back to legacy drafts and migrates them into the repo', async () => {
    mockRepo.createInitialBuildAndDraft.mockResolvedValue({
      build: { id: 'build-legacy' },
      draft: { id: 'draft-migrated' },
    })
    mockRepo.updateDraft.mockResolvedValue({})
    mockPrisma.designStorefrontDraft.findUnique.mockResolvedValue({
      id: 'legacy-id',
      token: 'legacy-token-123',
      shopDomain: access.shopDomain,
      status: DesignStorefrontDraftStatus.ACTIVE,
      selections: samplePayload.selections,
      summary: samplePayload.summary,
      customer: null,
      metadata: { steps: [], featureFlags: [], validation: null },
      notes: null,
      expiresAt: new Date(Date.now() + 1000),
    })

    const { loadDesignStorefrontDraft } = await import('../storefrontDraft.server')
    const result = await loadDesignStorefrontDraft({ access, token: 'legacy-token-123' })

    expect(result.token).toBe('draft-migrated')
    expect(mockRepo.createInitialBuildAndDraft).toHaveBeenCalled()
    expect(mockPrisma.designStorefrontDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ token: 'legacy-token-123' }) }),
    )
  })
})
