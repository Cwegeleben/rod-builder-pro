// <!-- BEGIN RBP GENERATED: importer-review-debug-api-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const { prisma } = await import('../db.server')
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ error: 'Not found' }, { status: 404 })
  const logs = await prisma.importLog.findMany({
    where: { runId },
    orderBy: { at: 'desc' },
    take: 50,
    select: { id: true, type: true, at: true, payload: true },
  })
  return json({
    run: { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, summary: run.summary },
    logs,
  })
}

export default function ImporterRunDebugApi() {
  return null
}
// <!-- END RBP GENERATED: importer-review-debug-api-v1 -->
