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
