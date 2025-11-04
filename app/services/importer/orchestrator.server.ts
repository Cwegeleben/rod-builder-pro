import { prisma } from '../../db.server'
import type { RunOptions } from './runOptions.server'

// Lightweight orchestrator wrapper for Prepare Review runs.
// Centralizes logs and delegates crawl/stage/diff to existing implementation for now.
// Future: break phases out and add idempotent/resumable checkpoints and cancel hooks.

type AdminClient = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> }

export async function runPrepareJob(args: {
  templateId: string
  options: RunOptions
  runId?: string
  admin?: AdminClient
}): Promise<string> {
  const { templateId, options, runId, admin } = args
  await prisma.importLog.create({
    data: { templateId, runId: runId || 'n/a', type: 'orchestrator:start', payload: { options } },
  })
  try {
    const { startImportFromOptions } = await import('./runOptions.server')
    const id = await startImportFromOptions(options, runId, admin)
    await prisma.importLog.create({ data: { templateId, runId: id, type: 'orchestrator:done', payload: {} } })
    return id
  } catch (err) {
    const message = (err as Error)?.message || 'unknown'
    const isCancelled = message === 'cancelled'
    if (runId) {
      try {
        await prisma.importRun.update({ where: { id: runId }, data: { status: isCancelled ? 'cancelled' : 'failed' } })
      } catch {
        /* ignore */
      }
    }
    await prisma.importLog.create({
      data: {
        templateId,
        runId: runId || 'n/a',
        type: isCancelled ? 'orchestrator:cancelled' : 'orchestrator:error',
        payload: { message },
      },
    })
    throw err
  }
}

// Dequeue and start the next queued run for the given template, if any.
export async function startNextQueuedForTemplate(templateId: string): Promise<void> {
  // Find the oldest queued run linked to this template via logs
  // 1) Get recent queued logs for the template
  const queuedLogs = await prisma.importLog.findMany({
    where: { templateId, type: 'prepare:queued' },
    orderBy: { at: 'asc' },
    take: 10,
  })
  for (const log of queuedLogs) {
    const runId = log.runId
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run || run.status !== 'queued') continue
    // Extract options and preflight snapshot from summary
    const summary = (run.summary as unknown as { preflight?: unknown; options?: unknown }) || {}
    const options = summary.options as RunOptions as RunOptions
    try {
      // Mark as preparing and set template pointer
      await prisma.importRun.update({ where: { id: runId }, data: { status: 'preparing' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: runId } })
      await prisma.importLog.create({
        data: { templateId, runId, type: 'prepare:start', payload: summary.preflight || {} },
      })
      // Fire-and-forget run
      setTimeout(() => {
        runPrepareJob({ templateId, options, runId })
          .then(async () => {
            // Clear pointer and log done
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
            await prisma.importLog.create({ data: { templateId, runId, type: 'prepare:done', payload: {} } })
            // Recurse to start another if present
            await startNextQueuedForTemplate(templateId)
          })
          .catch(async (err: unknown) => {
            try {
              await prisma.importRun.update({ where: { id: runId }, data: { status: 'failed' } })
            } catch {
              /* ignore */
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
            await prisma.importLog.create({
              data: {
                templateId,
                runId,
                type: 'prepare:error',
                payload: { message: (err as Error)?.message || 'unknown' },
              },
            })
            await startNextQueuedForTemplate(templateId)
          })
      }, 0)
      // Only kick one queued run at a time
      break
    } catch {
      // If any step fails, continue scanning the next queued log
      continue
    }
  }
}
