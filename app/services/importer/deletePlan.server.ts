import { BLOCKER_CODES } from './delete.constants'

export interface Blocker {
  code: string
  templateIds: string[]
}

export interface DeletePlanCounts {
  templates: number
  logs: number
  runs: number
  diffs: number
  staging: number
  sources: number
}

export interface DeletePlan {
  templates: Array<{ id: string; preparingRunId?: string | null }>
  runIds: string[]
  counts: DeletePlanCounts
  blockers: Blocker[]
}

type PrismaLike = {
  importTemplate: { findMany: (args: unknown) => Promise<Array<{ id: string; preparingRunId?: string | null }>> }
  importLog: {
    findMany: (args: unknown) => Promise<Array<{ templateId?: string; runId?: string }>>
    count: (args: unknown) => Promise<number>
  }
  importRun: { count: (args: unknown) => Promise<number> }
  importDiff: { count: (args: unknown) => Promise<number> }
  partStaging: { count: (args: unknown) => Promise<number> }
  productSource: { count: (args: unknown) => Promise<number> }
}

interface BuildArgs {
  prisma: PrismaLike | any
  templateIds: string[]
  dry: boolean
  force: boolean
}

// Build delete plan: gather templates, related runIds, counts, and active blockers
export async function buildDeletePlan({ prisma, templateIds }: BuildArgs): Promise<DeletePlan> {
  // Fetch templates (existence + preparingRunId)
  const templates = await prisma.importTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, preparingRunId: true },
  })

  const blockers: Blocker[] = []
  // Prepare blockers
  const prepareBlocked = templates.filter((t: { id: string; preparingRunId?: string | null }) => t.preparingRunId)
  if (prepareBlocked.length) {
    blockers.push({ code: BLOCKER_CODES.ACTIVE_PREPARE, templateIds: prepareBlocked.map((t: { id: string }) => t.id) })
  }

  // Publish in progress: recent publish:progress logs (5 min window)
  let publishBlockedIds: string[] = []
  try {
    const recentIso = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const rows = await prisma.importLog.findMany({
      where: { templateId: { in: templateIds }, type: 'publish:progress', at: { gte: recentIso } },
      select: { templateId: true },
    })
    publishBlockedIds = Array.from(
      new Set(
        rows
          .map((r: { templateId?: string }) => r.templateId)
          .filter((id: unknown): id is string => typeof id === 'string'),
      ),
    )
  } catch {
    publishBlockedIds = []
  }
  if (publishBlockedIds.length)
    blockers.push({ code: BLOCKER_CODES.PUBLISH_IN_PROGRESS, templateIds: publishBlockedIds })

  // Collect runIds via importLog (logs have templateId & runId)
  const logs = await prisma.importLog.findMany({
    where: { templateId: { in: templateIds } },
    select: { runId: true },
  })
  const runIdPattern = /^[a-z0-9]{10,}$/
  const runIds: string[] = Array.from(
    new Set(
      logs
        .map((l: { runId?: string }) => l.runId)
        .filter((r: string | undefined): r is string => typeof r === 'string' && runIdPattern.test(r)),
    ),
  )

  // Related counts
  const [runsCount, diffsCount, stagingCount, sourcesCount, logsCount] = await Promise.all([
    runIds.length ? prisma.importRun.count({ where: { id: { in: runIds } } }) : Promise.resolve(0),
    runIds.length ? prisma.importDiff.count({ where: { importRunId: { in: runIds } } }) : Promise.resolve(0),
    prisma.partStaging.count({ where: { templateId: { in: templateIds } } }),
    prisma.productSource.count({ where: { templateId: { in: templateIds } } }),
    prisma.importLog.count({ where: { templateId: { in: templateIds } } }),
  ])

  const counts: DeletePlanCounts = {
    templates: templates.length,
    logs: logsCount,
    runs: runsCount,
    diffs: diffsCount,
    staging: stagingCount,
    sources: sourcesCount,
  }

  return { templates, runIds, counts, blockers }
}
