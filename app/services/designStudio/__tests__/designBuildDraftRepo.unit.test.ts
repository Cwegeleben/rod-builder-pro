import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

// <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 -->
const hoisted = vi.hoisted(() => ({ mockDb: createInMemoryPrisma() })) as {
  mockDb: ReturnType<typeof createInMemoryPrisma>
}

vi.mock('../../../db.server', () => ({ prisma: hoisted.mockDb.prisma }))

function requireMockDb() {
  return hoisted.mockDb
}

import {
  createInitialBuildAndDraft,
  getLatestDraftForTenantAndUser,
  touchDraft,
  updateDraft,
} from '../designBuildDraftRepo.server'
import { DesignBuildStatus } from '@prisma/client'

describe('designBuildDraftRepo', () => {
  beforeEach(() => {
    requireMockDb().reset()
    vi.clearAllMocks()
  })

  it('creates an initial build and draft tied to latestDraftId', async () => {
    const result = await createInitialBuildAndDraft({
      tenantId: 'tenant-1',
      userId: 'user-1',
      initialPayload: { selections: [] },
    })

    expect(result.build.status).toBe(DesignBuildStatus.DRAFT)
    const state = requireMockDb().state
    const storedBuild = state.builds.at(0)
    const storedDraft = state.drafts.at(0)
    expect(storedBuild?.latestDraftId).toBe(storedDraft?.id)
    expect(storedDraft?.version).toBe(1)
    expect(storedDraft?.status).toBe('active')
  })

  it('updates an existing draft payload and keeps latestDraftId synced', async () => {
    const { draft } = await createInitialBuildAndDraft({
      tenantId: 'tenant-1',
      userId: 'user-1',
      initialPayload: { foo: 'bar' },
    })
    const state = requireMockDb().state
    const previousTouchedAt = state.drafts[0].lastTouchedAt

    await new Promise(resolve => setTimeout(resolve, 1))

    const nextExpiry = new Date(Date.now() + 5000)

    await updateDraft(draft.id, { draftPayload: { foo: 'baz' }, expiresAt: nextExpiry })

    const storedDraft = state.drafts[0]
    expect(storedDraft.draftPayload).toEqual({ foo: 'baz' })
    expect(storedDraft.lastTouchedAt.getTime()).toBeGreaterThan(previousTouchedAt.getTime())
    expect(storedDraft.expiresAt?.getTime()).toBe(nextExpiry.getTime())
    const storedBuild = state.builds[0]
    expect(storedBuild.latestDraftId).toBe(storedDraft.id)
  })

  it('returns the latest active draft for a tenant + user and null otherwise', async () => {
    const first = await createInitialBuildAndDraft({
      tenantId: 'tenant-2',
      userId: 'user-2',
      initialPayload: { version: 1 },
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    await createInitialBuildAndDraft({
      tenantId: 'tenant-2',
      userId: 'user-2',
      initialPayload: { version: 2 },
    })
    const latestBeforeTouch = await getLatestDraftForTenantAndUser('tenant-2', 'user-2')
    expect(latestBeforeTouch?.draftPayload).toEqual({ version: 2 })

    await touchDraft(first.draft.id)

    const latestAfterTouch = await getLatestDraftForTenantAndUser('tenant-2', 'user-2')
    expect(latestAfterTouch?.draftPayload).toEqual({ version: 1 })

    const missing = await getLatestDraftForTenantAndUser('tenant-unknown', 'user-unknown')
    expect(missing).toBeNull()
  })
})

function createInMemoryPrisma() {
  type BuildRecord = {
    id: string
    tenantId: string
    createdByUserId: string
    status: string
    roleSelections: Prisma.JsonValue | null
    compatContext: Prisma.JsonValue | null
    validationSnapshot: Prisma.JsonValue | null
    telemetryVersion?: string | null
    notes?: string | null
    legacyBuildId?: string | null
    latestDraftId?: string | null
  }
  type DraftRecord = {
    id: string
    buildId: string
    tenantId: string
    createdByUserId: string
    version: number
    draftPayload: Prisma.JsonValue
    compatContext: Prisma.JsonValue | null
    validationSnapshot: Prisma.JsonValue | null
    status: string
    lastTouchedAt: Date
    importedFromExternalId?: string | null
    expiresAt?: Date | null
  }

  const state = {
    builds: [] as BuildRecord[],
    drafts: [] as DraftRecord[],
    buildSeq: 1,
    draftSeq: 1,
  }

  const prisma = {
    designBuild: {
      create: vi.fn(async ({ data }: { data: Partial<BuildRecord> }) => {
        const record: BuildRecord = {
          id: data.id ?? `build-${state.buildSeq++}`,
          tenantId: data.tenantId as string,
          createdByUserId: data.createdByUserId as string,
          status: data.status as string,
          roleSelections: (data.roleSelections as Prisma.JsonValue) ?? null,
          compatContext: (data.compatContext as Prisma.JsonValue) ?? null,
          validationSnapshot: (data.validationSnapshot as Prisma.JsonValue) ?? null,
          telemetryVersion: data.telemetryVersion ?? null,
          notes: data.notes ?? null,
          legacyBuildId: data.legacyBuildId ?? null,
          latestDraftId: data.latestDraftId ?? null,
        }
        state.builds.push(record)
        return { ...record }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<BuildRecord> }) => {
        const record = state.builds.find(b => b.id === where.id)
        if (!record) throw new Error(`build ${where.id} not found`)
        Object.assign(record, data)
        return { ...record }
      }),
    },
    designBuildDraft: {
      create: vi.fn(async ({ data }: { data: Partial<DraftRecord> }) => {
        const record: DraftRecord = {
          id: data.id ?? `draft-${state.draftSeq++}`,
          buildId: data.buildId as string,
          tenantId: data.tenantId as string,
          createdByUserId: data.createdByUserId as string,
          version: data.version as number,
          draftPayload: data.draftPayload as Prisma.JsonValue,
          compatContext: (data.compatContext as Prisma.JsonValue) ?? null,
          validationSnapshot: (data.validationSnapshot as Prisma.JsonValue) ?? null,
          status: data.status as string,
          lastTouchedAt: (data.lastTouchedAt as Date) ?? new Date(),
          importedFromExternalId: data.importedFromExternalId ?? null,
          expiresAt: (data.expiresAt as Date) ?? null,
        }
        state.drafts.push(record)
        return { ...record }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<DraftRecord> }) => {
        const record = state.drafts.find(d => d.id === where.id)
        if (!record) throw new Error(`draft ${where.id} not found`)
        Object.assign(record, data)
        if (data.lastTouchedAt instanceof Date) {
          record.lastTouchedAt = data.lastTouchedAt
        }
        return { ...record }
      }),
      findFirst: vi.fn(async ({ where, include, orderBy }: Prisma.DesignBuildDraftFindFirstArgs) => {
        let drafts = state.drafts.slice()
        if (where?.tenantId) drafts = drafts.filter(d => d.tenantId === where.tenantId)
        if (where?.createdByUserId) drafts = drafts.filter(d => d.createdByUserId === where.createdByUserId)
        if (where?.status) drafts = drafts.filter(d => d.status === where.status)
        if (where?.build && typeof where.build === 'object') {
          drafts = drafts.filter(d => {
            const build = state.builds.find(b => b.id === d.buildId)
            if (!build) return false
            if (where.build?.tenantId && build.tenantId !== where.build.tenantId) return false
            if (where.build?.createdByUserId && build.createdByUserId !== where.build.createdByUserId) return false
            return true
          })
        }
        if (orderBy && 'lastTouchedAt' in orderBy) {
          drafts.sort((a, b) => {
            const dir = orderBy.lastTouchedAt === 'desc' ? -1 : 1
            return (a.lastTouchedAt.getTime() - b.lastTouchedAt.getTime()) * dir
          })
        }
        const result = drafts.at(0)
        if (!result) return null
        if (include?.build) {
          const build = state.builds.find(b => b.id === result.buildId)
          return build ? { ...result, build: { ...build } } : null
        }
        return { ...result }
      }),
    },
  }

  return {
    prisma,
    state,
    reset() {
      state.builds = []
      state.drafts = []
      state.buildSeq = 1
      state.draftSeq = 1
    },
  }
}
// <!-- END RBP GENERATED: design-studio-phase-c-v1 -->
