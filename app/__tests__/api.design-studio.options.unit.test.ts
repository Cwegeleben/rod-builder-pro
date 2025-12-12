import { describe, it, beforeEach, expect, vi } from 'vitest'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { loader } from '../routes/api.design-studio.options'

const { mockAccess, mockRoleGuard, mockLoadOptions, mockCors } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockRoleGuard: vi.fn(() => true),
  mockLoadOptions: vi.fn(),
  mockCors: vi.fn(() => ({ 'access-control-allow-origin': '*' })),
}))

vi.mock('../lib/designStudio/access.server', () => ({
  getDesignStudioAccess: mockAccess,
}))

vi.mock('../lib/designStudio/storefront.server', () => ({
  isDesignStorefrontPartRole: mockRoleGuard,
  loadDesignStorefrontOptions: mockLoadOptions,
}))

vi.mock('../utils/shopifyCors.server', () => ({
  buildShopifyCorsHeaders: mockCors,
}))

describe('api.design-studio.options loader', () => {
  const baseUrl = 'https://app.example.com/api/design-studio/options'

  beforeEach(() => {
    mockAccess.mockReset()
    mockRoleGuard.mockReset()
    mockRoleGuard.mockReturnValue(true)
    mockLoadOptions.mockReset()
    mockCors.mockClear()
  })

  it('returns 403 when access disabled', async () => {
    mockAccess.mockResolvedValue({
      enabled: false,
      reason: 'tenant-disabled',
      tier: 'STARTER',
      shopDomain: null,
      config: null,
    })

    const response = await loader({
      request: new Request(`${baseUrl}?role=blank`),
      context: {},
      params: {},
    } as LoaderFunctionArgs)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'tenant-disabled' })
    expect(mockLoadOptions).not.toHaveBeenCalled()
  })

  it('returns 400 when role param missing or invalid', async () => {
    mockAccess.mockResolvedValue({
      enabled: true,
      reason: 'enabled',
      tier: 'PLUS',
      shopDomain: 'tenant.myshopify.com',
      config: null,
    })
    mockRoleGuard.mockReturnValue(false)

    const response = await loader({
      request: new Request(baseUrl),
      context: {},
      params: {},
    } as LoaderFunctionArgs)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ options: [], issues: [] })
    expect(mockLoadOptions).not.toHaveBeenCalled()
  })

  it('returns options payload when role valid', async () => {
    const access = {
      enabled: true,
      reason: 'enabled',
      tier: 'PLUS',
      shopDomain: 'tenant.myshopify.com',
      config: null,
    }
    mockAccess.mockResolvedValue(access)
    mockRoleGuard.mockReturnValue(true)
    const options = [
      {
        id: 'blank-rx10-76ml',
        productId: 'product-1',
        role: 'blank',
        title: 'Rainshadow Eternity RX10',
        price: 189,
        specs: [],
      },
    ]
    mockLoadOptions.mockResolvedValue({ options, issues: [] })

    const response = await loader({
      request: new Request(`${baseUrl}?role=blank&take=100`),
      context: {},
      params: {},
    } as LoaderFunctionArgs)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ options, issues: [] })
    expect(mockLoadOptions).toHaveBeenCalledWith({ access, role: 'blank', take: 60, compatibilityContext: null })
    expect(mockCors).toHaveBeenCalled()
  })

  it('passes compatibility context through when provided', async () => {
    const access = {
      enabled: true,
      reason: 'enabled',
      tier: 'PLUS',
      shopDomain: 'tenant.myshopify.com',
      config: null,
    }
    mockAccess.mockResolvedValue(access)
    mockRoleGuard.mockReturnValue(true)
    mockLoadOptions.mockResolvedValue({ options: [], issues: [] })

    const contextPayload = encodeURIComponent(JSON.stringify({ blank: { buttDiameterIn: 0.9 } }))
    await loader({
      request: new Request(`${baseUrl}?role=handle&compat=${contextPayload}`),
      context: {},
      params: {},
    } as LoaderFunctionArgs)

    expect(mockLoadOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        access,
        role: 'handle',
        take: undefined,
        compatibilityContext: {
          blank: expect.objectContaining({ buttDiameterIn: 0.9 }),
        },
      }),
    )
  })
})
