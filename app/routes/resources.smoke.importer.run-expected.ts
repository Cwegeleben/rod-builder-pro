import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { guardSmokeRoute } from '../lib/smokes.server'

// Returns expectedItems (from preflight), current staged count for supplier, and diff count for run
// Query: ?runId=...&token=...
export async function loader({ request }: LoaderFunctionArgs) {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = String(url.searchParams.get('runId') || '')
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })
  const supplierId = run.supplierId
  const summary = (run.summary as unknown as { preflight?: { expectedItems?: number } } | null) || null
  const expectedItems = summary?.preflight?.expectedItems
  const stagedCount = await prisma.partStaging.count({ where: { supplierId } })
  const diffCount = await prisma.importDiff.count({ where: { importRunId: runId } })
  return json({ ok: true, runId, supplierId, expectedItems, stagedCount, diffCount })
}

export const handle = { private: true }

// No default export to keep this as a pure resource route returning JSON
