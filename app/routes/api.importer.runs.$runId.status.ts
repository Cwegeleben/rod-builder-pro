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

  const summary = (run.summary as unknown as { counts?: Record<string, number>; preflight?: unknown }) || {}
  return json({
    runId: run.id,
    status: run.status,
    counts: summary.counts || {},
    preflight: summary.preflight || null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
  })
}

export default function ImportRunStatusApi() {
  return null
}
