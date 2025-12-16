import type { DesignBuildStatus, DesignBuildEventType, DesignStudioTier, Prisma } from '@prisma/client'
import { prisma } from '../../db.server'
import { QUEUE_STATUS_ORDER, QUEUE_STATUS_LABELS } from './types'
import type { DesignBuildSummary, DesignBuildQueueGroup, DesignBuildDetail, DesignBuildActionIntent } from './types'

export type LoadDesignBuildQueueArgs = {
  shopDomain: string
  status?: DesignBuildStatus
  tier?: DesignStudioTier
  search?: string | null
  take?: number
}

const NORMALIZED_TAKE = 25

export async function loadDesignBuildQueue({
  shopDomain,
  status,
  tier,
  search,
  take = NORMALIZED_TAKE,
}: LoadDesignBuildQueueArgs): Promise<DesignBuildQueueGroup[]> {
  const baseWhere = buildWhereClause({ shopDomain, tier, search })
  const statusList = status ? [status] : QUEUE_STATUS_ORDER

  const [counts, buildResults] = await Promise.all([
    prisma.designBuild.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    }),
    Promise.all(
      statusList.map(currentStatus =>
        prisma.designBuild.findMany({
          where: { ...baseWhere, status: currentStatus },
          orderBy: { updatedAt: 'desc' },
          take,
        }),
      ),
    ),
  ])

  const countMap = new Map<DesignBuildStatus, number>()
  for (const entry of counts) {
    countMap.set(entry.status, entry._count._all)
  }

  return statusList.map((currentStatus, index) => ({
    status: currentStatus,
    label: QUEUE_STATUS_LABELS[currentStatus],
    totalCount: countMap.get(currentStatus) || 0,
    builds: buildResults[index]?.map(mapBuildSummary) || [],
  }))
}

const ACTIVE_CUSTOMER_STATUSES: DesignBuildStatus[] = ['REVIEW', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS']

export type LoadRecentDesignBuildSummariesArgs = {
  shopDomain: string
  statuses: DesignBuildStatus[]
  take?: number
}

export async function loadRecentDesignBuildSummaries({
  shopDomain,
  statuses,
  take = 3,
}: LoadRecentDesignBuildSummariesArgs): Promise<DesignBuildSummary[]> {
  if (!shopDomain || !statuses.length) {
    return []
  }
  const cappedTake = clampRecentTake(take)
  const builds = await prisma.designBuild.findMany({
    where: {
      shopDomain,
      status: { in: statuses },
    },
    orderBy: { updatedAt: 'desc' },
    take: cappedTake,
  })
  return builds.map(mapBuildSummary)
}

export type ActiveDesignBuildSummary = {
  id: string
  reference: string
  status: DesignBuildStatus
  submittedAt: string | null
  updatedAt: string
  blankTitle: string | null
  blankSku: string | null
  pricing: {
    subtotal: number
    basePrice: number
    selectedParts: number
    totalParts: number
  }
  components: Array<{ title: string | null; role: string | null; price: number }>
}

export async function loadLatestActiveDesignBuildSummary(
  shopDomain: string,
  statuses: DesignBuildStatus[] = ACTIVE_CUSTOMER_STATUSES,
): Promise<ActiveDesignBuildSummary | null> {
  if (!shopDomain || !statuses.length) return null
  const build = await prisma.designBuild.findFirst({
    where: {
      shopDomain,
      status: { in: statuses },
    },
    orderBy: { updatedAt: 'desc' },
  })
  if (!build) return null
  return mapActiveDesignBuildSummary(build)
}

export async function loadDesignBuildDetail(buildId: string): Promise<DesignBuildDetail | null> {
  const build = await prisma.designBuild.findUnique({
    where: { id: buildId },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!build) return null
  return {
    build: {
      id: build.id,
      reference: build.reference,
      shopDomain: build.shopDomain,
      tier: build.tier,
      status: build.status,
      fulfillmentMode: build.fulfillmentMode,
      customerName: build.customerName,
      customerEmail: build.customerEmail,
      customerPhone: build.customerPhone,
      useCase: build.useCase,
      experienceLevel: build.experienceLevel,
      blankSku: build.blankSku,
      blankTitle: build.blankTitle,
      componentSummary: build.componentSummary,
      bomHash: build.bomHash,
      promisedShipWeek: build.promisedShipWeek ? build.promisedShipWeek.toISOString() : null,
      assignedBuilder: build.assignedBuilder,
      budgetCeiling: build.budgetCeiling ? build.budgetCeiling.toString() : null,
      notesJson: build.notesJson,
      metadata: build.metadata,
      submittedAt: build.submittedAt ? build.submittedAt.toISOString() : null,
      approvedAt: build.approvedAt ? build.approvedAt.toISOString() : null,
      scheduledAt: build.scheduledAt ? build.scheduledAt.toISOString() : null,
      fulfilledAt: build.fulfilledAt ? build.fulfilledAt.toISOString() : null,
      blockedReason: build.blockedReason,
      createdAt: build.createdAt.toISOString(),
      updatedAt: build.updatedAt.toISOString(),
    },
    events: build.events.map(event => ({
      id: event.id,
      eventType: event.eventType,
      payload: event.payload,
      performedBy: event.performedBy,
      createdAt: event.createdAt.toISOString(),
    })),
  }
}

type TimestampField = 'approvedAt' | 'scheduledAt'

const ACTION_RULES: Record<
  DesignBuildActionIntent,
  { nextStatus: DesignBuildStatus; allowedFrom: DesignBuildStatus[]; timestampField?: TimestampField }
> = {
  approve: {
    nextStatus: 'APPROVED',
    allowedFrom: ['REVIEW'],
    timestampField: 'approvedAt',
  },
  request_edits: {
    nextStatus: 'REVIEW',
    allowedFrom: ['REVIEW', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS'],
  },
  schedule: {
    nextStatus: 'SCHEDULED',
    allowedFrom: ['APPROVED'],
    timestampField: 'scheduledAt',
  },
}

export class DesignBuildActionError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'UNKNOWN',
  ) {
    super(message)
    this.name = 'DesignBuildActionError'
  }
}

type ApplyDesignBuildActionArgs = {
  buildId: string
  shopDomain: string
  action: DesignBuildActionIntent
  note?: string
  performedBy?: string | null
}

export async function applyDesignBuildAction({
  buildId,
  shopDomain,
  action,
  note,
  performedBy,
}: ApplyDesignBuildActionArgs): Promise<DesignBuildDetail> {
  const rule = ACTION_RULES[action]
  if (!rule) {
    throw new DesignBuildActionError('Unsupported action', 'INVALID_TRANSITION')
  }

  await prisma.$transaction(async tx => {
    const build = await tx.designBuild.findUnique({ where: { id: buildId } })
    if (!build) {
      throw new DesignBuildActionError('Build not found', 'NOT_FOUND')
    }
    if (build.shopDomain !== shopDomain) {
      throw new DesignBuildActionError('Forbidden', 'FORBIDDEN')
    }
    if (!rule.allowedFrom.includes(build.status)) {
      throw new DesignBuildActionError(`Cannot ${action} from ${build.status}`, 'INVALID_TRANSITION')
    }

    const updateData: Prisma.DesignBuildUpdateInput = {
      status: rule.nextStatus,
    }

    const now = new Date()
    if (rule.timestampField === 'approvedAt') {
      updateData.approvedAt = now
    } else if (rule.timestampField === 'scheduledAt') {
      updateData.scheduledAt = now
    }

    if (action === 'request_edits') {
      updateData.blockedReason = null
    }

    await tx.designBuild.update({
      where: { id: buildId },
      data: updateData,
    })

    const payload: Record<string, string | undefined> = {
      from: build.status,
      to: rule.nextStatus,
    }
    if (note?.trim()) {
      payload.note = note.trim()
    }

    await tx.designBuildEvent.create({
      data: {
        buildId,
        eventType: 'STATUS_CHANGE' as DesignBuildEventType,
        payload,
        performedBy: performedBy ? performedBy.slice(0, 120) : null,
      },
    })
  })

  const detail = await loadDesignBuildDetail(buildId)
  if (!detail) {
    throw new DesignBuildActionError('Build not found after update', 'NOT_FOUND')
  }
  return detail
}

type WhereArgs = {
  shopDomain: string
  tier?: DesignStudioTier
  search?: string | null
}

function buildWhereClause({ shopDomain, tier, search }: WhereArgs): Prisma.DesignBuildWhereInput {
  const where: Prisma.DesignBuildWhereInput = { shopDomain }
  if (tier) {
    where.tier = tier
  }
  const query = (search || '').trim()
  if (query) {
    where.AND = [
      {
        OR: [
          { reference: { contains: query } },
          { customerName: { contains: query } },
          { customerEmail: { contains: query } },
          { blankSku: { contains: query } },
        ],
      },
    ]
  }
  return where
}

type PrismaDesignBuild = Awaited<ReturnType<typeof prisma.designBuild.findMany>>[number]

function mapBuildSummary(build: PrismaDesignBuild): DesignBuildSummary {
  return {
    id: build.id,
    reference: build.reference,
    status: build.status,
    tier: build.tier,
    customerName: build.customerName,
    customerEmail: build.customerEmail,
    customerPhone: build.customerPhone,
    useCase: build.useCase,
    blankSku: build.blankSku,
    fulfillmentMode: build.fulfillmentMode,
    promisedShipWeek: build.promisedShipWeek ? build.promisedShipWeek.toISOString() : null,
    assignedBuilder: build.assignedBuilder,
    updatedAt: build.updatedAt.toISOString(),
  }
}

function mapActiveDesignBuildSummary(build: PrismaDesignBuild): ActiveDesignBuildSummary {
  const summary = parseComponentSummary(build.componentSummary)
  return {
    id: build.id,
    reference: build.reference,
    status: build.status,
    submittedAt: build.submittedAt ? build.submittedAt.toISOString() : null,
    updatedAt: build.updatedAt.toISOString(),
    blankTitle: build.blankTitle ?? summary.blank.title,
    blankSku: build.blankSku ?? summary.blank.sku,
    pricing: summary.pricing,
    components: summary.components,
  }
}

type ParsedComponentSummary = {
  blank: { title: string | null; sku: string | null }
  components: Array<{ title: string | null; role: string | null; price: number }>
  pricing: {
    subtotal: number
    basePrice: number
    selectedParts: number
    totalParts: number
  }
}

function parseComponentSummary(value: Prisma.JsonValue | null): ParsedComponentSummary {
  const record = asJsonObject(value)
  const blankRecord = asJsonObject(record?.blank)
  const pricingRecord = asJsonObject(record?.pricing)
  const componentsArray = Array.isArray(record?.components) ? record?.components : []
  return {
    blank: {
      title: coerceString(blankRecord?.title),
      sku: coerceString(blankRecord?.sku),
    },
    components: componentsArray
      .map(entry => {
        const component = asJsonObject(entry)
        if (!component) return null
        return {
          title: coerceString(component.title),
          role: coerceString(component.role),
          price: coerceNumber(component.price),
        }
      })
      .filter((entry): entry is { title: string | null; role: string | null; price: number } => entry !== null),
    pricing: {
      subtotal: coerceNumber(pricingRecord?.subtotal),
      basePrice: coerceNumber(pricingRecord?.basePrice),
      selectedParts: coerceNumber(pricingRecord?.selectedParts),
      totalParts: coerceNumber(pricingRecord?.totalParts),
    },
  }
}

function asJsonObject(value: Prisma.JsonValue | null | undefined): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, any>
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  return null
}

function coerceNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function clampRecentTake(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 3
  return Math.max(1, Math.min(3, Math.floor(value)))
}
