import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import type { DesignBuildDetail } from '../lib/designStudio/types'
import { action, loader } from '../routes/api.design-studio.builds.$buildId'
import { DesignBuildActionError } from '../lib/designStudio/builds.server'

const { mockAuthenticate, mockAccess, mockLoadDetail, mockApplyAction, mockExportAction } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockAccess: vi.fn(),
  mockLoadDetail: vi.fn(),
  mockApplyAction: vi.fn(),
  mockExportAction: vi.fn(),
}))

vi.mock('../shopify.server', () => ({
  authenticate: {
    admin: mockAuthenticate,
  },
}))

vi.mock('../lib/designStudio/access.server', () => ({
  getDesignStudioAccess: mockAccess,
}))

vi.mock('../lib/designStudio/builds.server', async () => {
  const actual = await vi.importActual<typeof import('../lib/designStudio/builds.server')>(
    '../lib/designStudio/builds.server',
  )
  return {
    ...actual,
    loadDesignBuildDetail: mockLoadDetail,
    applyDesignBuildAction: mockApplyAction,
  }
})

vi.mock('../services/designStudio/exportBuild.server', () => ({
  exportDesignBuildPacket: mockExportAction,
}))

function createDetail(overrides: Partial<DesignBuildDetail> = {}): DesignBuildDetail {
  const now = '2024-06-15T10:00:00.000Z'
  return {
    build: {
      id: 'build-1',
      reference: 'BUILD-1',
      shopDomain: 'batson.myshopify.com',
      tier: 'CORE',
      status: 'REVIEW',
      fulfillmentMode: 'RBP_BUILD',
      customerName: 'Rainshadow',
      customerEmail: 'ops@example.com',
      customerPhone: null,
      useCase: 'Demo',
      experienceLevel: 'Intermediate',
      blankSku: 'RS-1',
      blankTitle: 'Rainshadow blank',
      componentSummary: '[]',
      bomHash: 'hash',
      promisedShipWeek: null,
      assignedBuilder: null,
      budgetCeiling: null,
      notesJson: [],
      metadata: null,
      submittedAt: now,
      approvedAt: null,
      scheduledAt: null,
      fulfilledAt: null,
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
    },
    events: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockAuthenticate.mockResolvedValue({ session: { shop: 'batson.myshopify.com' } })
  mockAccess.mockResolvedValue({ enabled: true, shopDomain: 'batson.myshopify.com' })
  mockLoadDetail.mockReset()
  mockApplyAction.mockReset()
  mockExportAction.mockReset()
})

describe('loader', () => {
  it('returns detail json when access granted', async () => {
    const detail = createDetail()
    mockLoadDetail.mockResolvedValue(detail)
    const response = await loader({
      request: new Request('https://example.com/api/design-studio/builds/build-1'),
      params: { buildId: 'build-1' },
      context: {},
    } as LoaderFunctionArgs)

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual(detail)
    expect(mockLoadDetail).toHaveBeenCalledWith('build-1')
  })

  it('forbids access when build shop does not match tenant', async () => {
    const detail = createDetail({ build: { ...createDetail().build, shopDomain: 'other-shop.myshopify.com' } })
    mockLoadDetail.mockResolvedValue(detail)

    await expect(
      loader({
        request: new Request('https://example.com/api/design-studio/builds/build-1'),
        params: { buildId: 'build-1' },
        context: {},
      } as LoaderFunctionArgs),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('action', () => {
  it('rejects request edits without a note', async () => {
    const form = new FormData()
    form.append('_action', 'request_edits')
    const response = await action({
      request: new Request('https://example.com/api/design-studio/builds/build-1', { method: 'POST', body: form }),
      params: { buildId: 'build-1' },
      context: {},
    } as ActionFunctionArgs)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Add a note before requesting edits.' })
    expect(mockApplyAction).not.toHaveBeenCalled()
  })

  it('passes through to helper and returns updated detail', async () => {
    const detail = createDetail({
      build: { ...createDetail().build, status: 'APPROVED', approvedAt: '2024-06-15T10:00:00.000Z' },
    })
    mockApplyAction.mockResolvedValue(detail)
    const form = new FormData()
    form.append('_action', 'approve')
    const request = new Request('https://example.com/api/design-studio/builds/build-1', {
      method: 'POST',
      body: form,
      headers: { 'x-shopify-user-email': 'approver@example.com' },
    })

    const response = await action({ request, params: { buildId: 'build-1' }, context: {} } as ActionFunctionArgs)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, detail })
    expect(mockApplyAction).toHaveBeenCalledWith({
      buildId: 'build-1',
      shopDomain: 'batson.myshopify.com',
      action: 'approve',
      note: undefined,
      performedBy: 'approver@example.com',
    })
  })

  it('maps domain errors to status codes', async () => {
    mockApplyAction.mockRejectedValue(new DesignBuildActionError('Forbidden', 'FORBIDDEN'))
    const form = new FormData()
    form.append('_action', 'approve')

    const response = await action({
      request: new Request('https://example.com/api/design-studio/builds/build-1', { method: 'POST', body: form }),
      params: { buildId: 'build-1' },
      context: {},
    } as ActionFunctionArgs)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ ok: false, error: 'Forbidden' })
  })

  it('handles export build action', async () => {
    const detail = createDetail()
    const exportMeta = {
      url: 'https://exports/b1.json',
      key: 'builds/shop/build-1.json',
      exportedAt: '2024-06-16T00:00:00.000Z',
      bytes: 1024,
    }
    mockExportAction.mockResolvedValue({ detail, exportMeta })

    const form = new FormData()
    form.append('_action', 'export_build')
    const response = await action({
      request: new Request('https://example.com/api/design-studio/builds/build-1', {
        method: 'POST',
        body: form,
        headers: { 'x-shopify-user-name': 'Exporter' },
      }),
      params: { buildId: 'build-1' },
      context: {},
    } as ActionFunctionArgs)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, detail, export: exportMeta })
    expect(mockExportAction).toHaveBeenCalledWith({
      buildId: 'build-1',
      shopDomain: 'batson.myshopify.com',
      performedBy: 'Exporter',
    })
  })

  it('returns error payload when export fails', async () => {
    mockExportAction.mockRejectedValue(new DesignBuildActionError('Forbidden', 'FORBIDDEN'))
    const form = new FormData()
    form.append('_action', 'export_build')
    const response = await action({
      request: new Request('https://example.com/api/design-studio/builds/build-1', { method: 'POST', body: form }),
      params: { buildId: 'build-1' },
      context: {},
    } as ActionFunctionArgs)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ ok: false, error: 'Forbidden' })
  })
})
