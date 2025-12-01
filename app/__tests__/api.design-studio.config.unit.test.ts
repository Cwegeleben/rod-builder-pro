import { describe, it, beforeEach, expect, vi } from 'vitest'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { loader } from '../routes/api.design-studio.config'

const { mockAccess, mockLoadConfig, mockCors } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockCors: vi.fn(() => ({ 'access-control-allow-origin': '*' })),
}))

vi.mock('../lib/designStudio/access.server', () => ({
  getDesignStudioAccess: mockAccess,
}))

vi.mock('../lib/designStudio/storefront.server', () => ({
  loadDesignStorefrontConfig: mockLoadConfig,
}))

vi.mock('../utils/shopifyCors.server', () => ({
  buildShopifyCorsHeaders: mockCors,
}))

describe('api.design-studio.config loader', () => {
  const request = new Request('https://app.example.com/api/design-studio/config')

  beforeEach(() => {
    mockAccess.mockReset()
    mockLoadConfig.mockReset()
    mockCors.mockClear()
  })

  it('returns 403 when tenant lacks access', async () => {
    mockAccess.mockResolvedValue({
      enabled: false,
      reason: 'flag-disabled',
      tier: 'STARTER',
      shopDomain: null,
      config: null,
    })

    const response = await loader({ request, context: {}, params: {} } as LoaderFunctionArgs)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'flag-disabled' })
    expect(mockCors).toHaveBeenCalledWith(request)
    expect(mockLoadConfig).not.toHaveBeenCalled()
  })

  it('returns config payload when access enabled', async () => {
    const config = {
      hero: { title: 'Hero', body: 'Body' },
      tier: 'PLUS',
      currency: 'USD',
      basePrice: 350,
      featureFlags: ['saved-builds'],
      steps: [{ id: 'step-blank', label: 'Blank', roles: ['blank'] }],
    }
    mockAccess.mockResolvedValue({
      enabled: true,
      reason: 'enabled',
      tier: 'PLUS',
      shopDomain: 'tenant.myshopify.com',
      config: null,
    })
    mockLoadConfig.mockResolvedValue(config)

    const response = await loader({ request, context: {}, params: {} } as LoaderFunctionArgs)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ config })
    expect(mockLoadConfig).toHaveBeenCalled()
    expect(mockCors).toHaveBeenCalledWith(request)
  })
})
