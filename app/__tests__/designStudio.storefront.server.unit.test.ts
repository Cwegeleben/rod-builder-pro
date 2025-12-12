import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import type { DesignStorefrontConfig } from '../lib/designStudio/storefront.mock'
import type { DesignStudioAccess } from '../lib/designStudio/access.server'

const mockPrisma = vi.hoisted(() => ({
  product: { findMany: vi.fn() },
}))

vi.mock('../db.server', () => ({ prisma: mockPrisma }))

const { mockGetMockConfig } = vi.hoisted(() => ({
  mockGetMockConfig: vi.fn<() => Promise<DesignStorefrontConfig>>(),
}))

vi.mock('../lib/designStudio/storefront.mock', async () => {
  const actual = await vi.importActual<typeof import('../lib/designStudio/storefront.mock')>(
    '../lib/designStudio/storefront.mock',
  )
  return {
    ...actual,
    getMockDesignStorefrontConfig: mockGetMockConfig,
  }
})

describe('loadDesignStorefrontConfig', () => {
  beforeEach(() => {
    mockPrisma.product.findMany.mockReset()
    mockGetMockConfig.mockResolvedValue({
      hero: { title: 'Mock hero', body: 'Mock body' },
      tier: 'PLUS',
      currency: 'USD',
      basePrice: 225,
      featureFlags: ['mock-flag'],
      steps: [{ id: 'mock', label: 'Mock', roles: ['blank'] }],
    })
  })

  it('merges tenant config into mock fallback when product DB disabled', async () => {
    const { loadDesignStorefrontConfig } = await import('../lib/designStudio/storefront.server')

    const tenantConfig = {
      wizardSteps: ['blank'],
      componentRoles: [{ role: 'blank' }],
      featureFlags: { 'saved-builds': true },
      copy: { heroTitle: 'Tenant hero', heroBody: 'Tenant body' },
      pricing: { basePrice: 777 },
    } satisfies Prisma.JsonValue

    const access: DesignStudioAccess = {
      enabled: true,
      reason: 'enabled',
      tier: 'CORE',
      shopDomain: 'tenant.myshopify.com',
      config: tenantConfig,
    }

    const config = await loadDesignStorefrontConfig(access)

    expect(config.hero.title).toBe('Tenant hero')
    expect(config.hero.body).toBe('Tenant body')
    expect(config.tier).toBe('CORE')
    expect(config.basePrice).toBe(777)
    expect(config.featureFlags).toEqual(['saved-builds'])
    expect(config.steps).toEqual([
      {
        id: 'step-blank',
        label: 'Step 1 · Blank',
        description: 'Pick the performance backbone for your build.',
        roles: ['blank'],
      },
    ])
  })
})
