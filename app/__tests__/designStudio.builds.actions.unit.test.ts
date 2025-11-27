import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DesignBuildStatus } from '@prisma/client'
import { applyDesignBuildAction, DesignBuildActionError } from '../lib/designStudio/builds.server'

type MockEvent = {
  id: string
  buildId: string
  eventType: string
  payload: Record<string, unknown>
  performedBy: string | null
  createdAt: Date
}

type MockBuild = {
  id: string
  reference: string
  shopDomain: string
  tier: 'STARTER' | 'CORE' | 'PLUS'
  status: DesignBuildStatus
  fulfillmentMode: string | null
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  useCase: string | null
  experienceLevel: string | null
  blankSku: string | null
  blankTitle: string | null
  componentSummary: string
  bomHash: string | null
  promisedShipWeek: Date | null
  assignedBuilder: string | null
  budgetCeiling: string | null
  notesJson: unknown
  metadata: unknown
  submittedAt: Date | null
  approvedAt: Date | null
  scheduledAt: Date | null
  fulfilledAt: Date | null
  blockedReason: string | null
  createdAt: Date
  updatedAt: Date
}

const { mockDb } = vi.hoisted(() => {
  const state = {
    builds: {} as Record<string, MockBuild>,
    events: {} as Record<string, MockEvent[]>,
    eventSeq: 1,
  }

  return { mockDb: state }
})

vi.mock('../db.server', () => {
  const cloneBuild = (build: MockBuild) => ({ ...build })

  const findUnique = async ({ where, include }: { where: { id: string }; include?: { events?: true } }) => {
    const build = mockDb.builds[where.id]
    if (!build) return null
    const result: MockBuild & { events?: MockEvent[] } = cloneBuild(build)
    if (include?.events) {
      result.events = (mockDb.events[build.id] || []).map(event => ({ ...event }))
    }
    return result
  }

  const update = async ({ where, data }: { where: { id: string }; data: Partial<MockBuild> }) => {
    const build = mockDb.builds[where.id]
    if (!build) throw new Error('Build not found')
    mockDb.builds[where.id] = {
      ...build,
      ...data,
      updatedAt: new Date(),
    } as MockBuild
    return mockDb.builds[where.id]
  }

  const createEvent = async ({
    data,
  }: {
    data: {
      buildId: string
      eventType: string
      payload: Record<string, unknown>
      performedBy: string | null
    }
  }) => {
    const event = {
      id: `evt-${mockDb.eventSeq++}`,
      ...data,
      createdAt: new Date(),
    }
    if (!mockDb.events[data.buildId]) {
      mockDb.events[data.buildId] = []
    }
    mockDb.events[data.buildId].push(event)
    return event
  }

  const designBuildEvent = {
    create: createEvent,
  }

  const designBuild = {
    findUnique,
    update,
  }

  return {
    prisma: {
      designBuild,
      designBuildEvent,
      $transaction: async <T>(
        fn: (tx: { designBuild: typeof designBuild; designBuildEvent: typeof designBuildEvent }) => Promise<T>,
      ) => fn({ designBuild, designBuildEvent }),
    },
  }
})

function createMockBuild(overrides: Partial<MockBuild> = {}): MockBuild {
  const now = new Date('2024-05-01T12:00:00.000Z')
  return {
    id: 'build-1',
    reference: 'BUILD-1',
    shopDomain: 'batson.myshopify.com',
    tier: 'CORE' as const,
    status: 'REVIEW' as DesignBuildStatus,
    fulfillmentMode: 'DROP_SHIP',
    customerName: 'Rainshadow Rod Co.',
    customerEmail: 'ops@example.com',
    customerPhone: null,
    useCase: 'Demo use case',
    experienceLevel: 'Intermediate',
    blankSku: 'RS-123',
    blankTitle: 'Rainshadow 7ft blank',
    componentSummary: JSON.stringify([{ role: 'guides', selectedSku: 'GUIDE-1' }]),
    bomHash: 'hash',
    promisedShipWeek: null,
    assignedBuilder: null,
    budgetCeiling: '1000.00',
    notesJson: [],
    metadata: null,
    submittedAt: now,
    approvedAt: null,
    scheduledAt: null,
    fulfilledAt: null,
    blockedReason: 'MISSING_INFO',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T10:00:00.000Z'))
  mockDb.builds = {
    'build-1': createMockBuild(),
  }
  mockDb.events = {}
  mockDb.eventSeq = 1
})

afterEach(() => {
  vi.useRealTimers()
})

describe('applyDesignBuildAction', () => {
  it('approves a build and records an event', async () => {
    const detail = await applyDesignBuildAction({
      buildId: 'build-1',
      shopDomain: 'batson.myshopify.com',
      action: 'approve',
      performedBy: 'approver@example.com',
    })

    expect(detail.build.status).toBe('APPROVED')
    expect(detail.build.approvedAt).toBe('2024-06-15T10:00:00.000Z')
    expect(detail.events[0]).toMatchObject({
      eventType: 'STATUS_CHANGE',
      payload: { from: 'REVIEW', to: 'APPROVED' },
      performedBy: 'approver@example.com',
    })
  })

  it('requests edits from any allowed status and clears blocked reason', async () => {
    mockDb.builds['build-1'].status = 'APPROVED'
    const detail = await applyDesignBuildAction({
      buildId: 'build-1',
      shopDomain: 'batson.myshopify.com',
      action: 'request_edits',
      note: 'Need updated dimensions',
      performedBy: 'reviewer@example.com',
    })

    expect(detail.build.status).toBe('REVIEW')
    expect(detail.build.blockedReason).toBeNull()
    expect(detail.events[0].payload).toEqual({ from: 'APPROVED', to: 'REVIEW', note: 'Need updated dimensions' })
  })

  it('throws when attempting an invalid transition', async () => {
    mockDb.builds['build-1'].status = 'DRAFT'

    await expect(
      applyDesignBuildAction({
        buildId: 'build-1',
        shopDomain: 'batson.myshopify.com',
        action: 'approve',
      }),
    ).rejects.toThrowError(DesignBuildActionError)
  })
})
