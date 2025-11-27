import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LoaderFunctionArgs } from '@remix-run/node'
import type { DesignStudioTier } from '@prisma/client'

const mockAccess = vi.fn()

vi.mock('../lib/designStudio/access.server', () => ({
  getDesignStudioAccess: mockAccess,
}))

const TIER_PLUS: DesignStudioTier = 'PLUS'
const TIER_STARTER: DesignStudioTier = 'STARTER'

describe('apps.proxy.design loader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  function createRequest(url = 'https://example.com/apps/proxy/design?shop=batson.myshopify.com') {
    return new Request(url)
  }

  async function runLoader(args?: Partial<LoaderFunctionArgs>) {
    const mod = await import('../routes/apps.proxy.design')
    const loader = mod.loader
    const request = args?.request ?? createRequest()
    return loader({ request, params: {}, context: {}, ...args } as LoaderFunctionArgs)
  }

  it('returns the access payload from design studio guard', async () => {
    const enabledAccess = {
      enabled: true,
      tier: TIER_PLUS,
      config: { hero: { title: 'Mock' } },
      shopDomain: 'batson.myshopify.com',
      reason: 'enabled' as const,
    }
    mockAccess.mockResolvedValue(enabledAccess)

    const response = await runLoader()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ designStudioAccess: enabledAccess })
    expect(mockAccess).toHaveBeenCalledWith(expect.any(Request))
  })

  it('passes through disabled reasons unchanged', async () => {
    const disabled = {
      enabled: false,
      tier: TIER_STARTER,
      config: null,
      shopDomain: null,
      reason: 'flag-disabled' as const,
    }
    mockAccess.mockResolvedValue(disabled)

    const response = await runLoader({ request: createRequest('https://example.com/apps/proxy/design') })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ designStudioAccess: disabled })
  })
})
