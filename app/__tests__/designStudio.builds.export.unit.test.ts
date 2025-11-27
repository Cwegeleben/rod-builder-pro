import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DesignBuildDetail } from '../lib/designStudio/types'
import { exportDesignBuildPacket } from '../services/designStudio/exportBuild.server'
import { DesignBuildActionError } from '../lib/designStudio/builds.server'

const { mockLoadDetail, mockUpload, mockCreateEvent } = vi.hoisted(() => ({
  mockLoadDetail: vi.fn(),
  mockUpload: vi.fn(),
  mockCreateEvent: vi.fn(),
}))

vi.mock('../lib/designStudio/builds.server', async () => {
  const actual = await vi.importActual<typeof import('../lib/designStudio/builds.server')>(
    '../lib/designStudio/builds.server',
  )
  return {
    ...actual,
    loadDesignBuildDetail: mockLoadDetail,
  }
})

vi.mock('../services/storage/s3.server', () => ({
  uploadObjectToS3: mockUpload,
}))

vi.mock('../db.server', () => ({
  prisma: {
    designBuildEvent: {
      create: mockCreateEvent,
    },
  },
}))

function buildDetail(overrides: Partial<DesignBuildDetail> = {}): DesignBuildDetail {
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
      componentSummary: {
        blank: { sku: 'RS-1', title: 'Blank' },
        components: [{ role: 'guide_set', sku: 'GS-1' }],
      },
      bomHash: 'hash',
      promisedShipWeek: null,
      assignedBuilder: null,
      budgetCeiling: null,
      notesJson: { body: 'Notes' },
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
  process.env.DESIGN_STUDIO_EXPORT_BUCKET = 'design-build-exports'
  process.env.DESIGN_STUDIO_EXPORT_PREFIX = 'builds'
  process.env.AWS_REGION = 'us-east-1'
  mockLoadDetail.mockReset()
  mockUpload.mockReset()
  mockCreateEvent.mockReset()
})

afterEach(() => {
  delete process.env.DESIGN_STUDIO_EXPORT_BUCKET
  delete process.env.DESIGN_STUDIO_EXPORT_PREFIX
})

describe('exportDesignBuildPacket', () => {
  it('uploads JSON packet and records event', async () => {
    const initial = buildDetail()
    const refreshed = buildDetail({
      events: [
        { id: 'evt-1', eventType: 'EXPORT', payload: null, performedBy: 'me', createdAt: '2024-06-16T00:00:00.000Z' },
      ],
    })
    mockLoadDetail.mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed)
    mockUpload.mockResolvedValue({
      bucket: 'design-build-exports',
      key: 'builds/batson.myshopify.com/build-1.json',
      url: 'https://example.com/build-1.json',
      bytes: 2048,
    })

    const result = await exportDesignBuildPacket({
      buildId: 'build-1',
      shopDomain: 'batson.myshopify.com',
      performedBy: 'Exporter',
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'design-build-exports',
        key: 'builds/batson.myshopify.com/build-1.json',
        contentType: 'application/json',
      }),
    )
    expect(mockCreateEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buildId: 'build-1',
        eventType: 'EXPORT',
        performedBy: 'Exporter',
      }),
    })
    expect(result.detail).toEqual(refreshed)
    expect(result.exportMeta.url).toBe('https://example.com/build-1.json')
  })

  it('throws when bucket missing', async () => {
    delete process.env.DESIGN_STUDIO_EXPORT_BUCKET
    mockLoadDetail.mockResolvedValue(buildDetail())
    await expect(
      exportDesignBuildPacket({ buildId: 'build-1', shopDomain: 'batson.myshopify.com' }),
    ).rejects.toThrowError(DesignBuildActionError)
  })

  it('validates shop ownership', async () => {
    mockLoadDetail.mockResolvedValue(
      buildDetail({ build: { ...buildDetail().build, shopDomain: 'other-shop.myshopify.com' } }),
    )
    await expect(
      exportDesignBuildPacket({ buildId: 'build-1', shopDomain: 'batson.myshopify.com' }),
    ).rejects.toThrowError(DesignBuildActionError)
  })

  it('throws when build missing', async () => {
    mockLoadDetail.mockResolvedValue(null)
    await expect(
      exportDesignBuildPacket({ buildId: 'missing', shopDomain: 'batson.myshopify.com' }),
    ).rejects.toThrowError(DesignBuildActionError)
  })
})
