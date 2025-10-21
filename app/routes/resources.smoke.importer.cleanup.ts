import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { prisma } from '../db.server'
import { guardSmokeRoute } from '../lib/smokes.server'

// Deletes smoke test artifacts. Supports optional runId param to target a single run.
// When runId is omitted, deletes ALL runs with supplierId="smoke" and their diffs.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')

  if (runId) {
    const deletedDiffs = await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
    const deletedRuns = await prisma.importRun.deleteMany({ where: { id: runId } })
    return json({ ok: true, deletedDiffs: deletedDiffs.count, deletedRuns: deletedRuns.count })
  }

  const runs = await prisma.importRun.findMany({ where: { supplierId: 'smoke' }, select: { id: true } })
  const ids = runs.map(r => r.id)
  if (ids.length === 0) return json({ ok: true, deletedDiffs: 0, deletedRuns: 0 })

  const deletedDiffs = await prisma.importDiff.deleteMany({ where: { importRunId: { in: ids } } })
  const deletedRuns = await prisma.importRun.deleteMany({ where: { id: { in: ids } } })
  return json({ ok: true, deletedDiffs: deletedDiffs.count, deletedRuns: deletedRuns.count })
}

export const handle = { private: true }
