import type { DesignBuildStatus, DesignFulfillmentMode, DesignStudioTier, Prisma } from '@prisma/client'

export type DesignBuildSummary = {
  id: string
  reference: string
  status: DesignBuildStatus
  tier: DesignStudioTier
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  useCase: string | null
  blankSku: string | null
  fulfillmentMode: DesignFulfillmentMode
  promisedShipWeek: string | null
  assignedBuilder: string | null
  updatedAt: string
}

export type DesignBuildQueueGroup = {
  status: DesignBuildStatus
  label: string
  totalCount: number
  builds: DesignBuildSummary[]
}

export type DesignBuildDetail = {
  build: {
    id: string
    reference: string
    shopDomain: string
    tier: DesignStudioTier
    status: DesignBuildStatus
    fulfillmentMode: DesignFulfillmentMode
    customerName: string | null
    customerEmail: string | null
    customerPhone: string | null
    useCase: string | null
    experienceLevel: string | null
    blankSku: string | null
    blankTitle: string | null
    componentSummary: Prisma.JsonValue | null
    bomHash: string | null
    promisedShipWeek: string | null
    assignedBuilder: string | null
    budgetCeiling: string | null
    notesJson: Prisma.JsonValue | null
    metadata: Prisma.JsonValue | null
    submittedAt: string | null
    approvedAt: string | null
    scheduledAt: string | null
    fulfilledAt: string | null
    blockedReason: string | null
    createdAt: string
    updatedAt: string
  }
  events: Array<{
    id: string
    eventType: string
    payload: Prisma.JsonValue | null
    performedBy: string | null
    createdAt: string
  }>
}

export const QUEUE_STATUS_ORDER: DesignBuildStatus[] = [
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'IN_PROGRESS',
  'FULFILLED',
  'BLOCKED',
  'DRAFT',
  'ARCHIVED',
]

export const QUEUE_STATUS_LABELS: Record<DesignBuildStatus, string> = {
  DRAFT: 'Draft',
  REVIEW: 'Needs review',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  FULFILLED: 'Fulfilled',
  ARCHIVED: 'Archived',
  BLOCKED: 'Blocked',
}

export type DesignBuildActionIntent = 'approve' | 'request_edits' | 'schedule'
