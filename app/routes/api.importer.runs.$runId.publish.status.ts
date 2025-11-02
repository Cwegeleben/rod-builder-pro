// <!-- BEGIN RBP GENERATED: importer-publish-status-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })

  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })

  const state = run.status as string
  const totalApproved = await prisma.importDiff.count({ where: { importRunId: runId, resolution: 'approve' } })

  // If publish summary exists, treat as completed and derive totals
  const publishSummary = (
    run.summary as unknown as {
      publish?: { totals?: { created: number; updated: number; skipped: number; failed: number }; at?: string }
    }
  )?.publish
  const completed = Boolean(publishSummary?.totals)

  const totals = publishSummary?.totals ?? { created: 0, updated: 0, skipped: 0, failed: 0 }
  const processed = completed ? totals.created + totals.updated + totals.skipped + totals.failed : 0
  const target = totalApproved
  const progress = completed
    ? 100
    : target > 0
      ? Math.max(5, Math.min(95, Math.floor((processed / target) * 100) || 10))
      : 10

  return json(
    {
      ok: true,
      runId,
      state: completed ? 'published' : state,
      progress,
      target,
      processed,
      totals,
      etaMs: null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export default function PublishRunStatusApi() {
  return null
}
// <!-- END RBP GENERATED: importer-publish-status-v1 -->
