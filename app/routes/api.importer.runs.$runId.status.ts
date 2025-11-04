import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'

// Return a lightweight status snapshot for polling.
// GET: /api/importer/runs/:runId/status
// { status, counts, preflight, startedAt, finishedAt }
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ error: 'Not found' }, { status: 404 })
  // Best-effort map run -> templateId
  let templateId: string | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = await (prisma as any).importTemplate.findFirst({
      where: { preparingRunId: runId },
      select: { id: true },
    })
    templateId = tpl?.id || null
  } catch {
    /* ignore */
  }

  const summary = (run.summary as unknown as { counts?: Record<string, number>; preflight?: unknown }) || {}
  return json({
    runId: run.id,
    status: run.status,
    templateId,
    // Use any-cast until Prisma client is regenerated with progress field
    progress: ((run as unknown as { progress?: unknown }).progress as unknown) || null,
    counts: summary.counts || {},
    preflight: summary.preflight || null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
  })
}

export default function ImportRunStatusApi() {
  return null
}
