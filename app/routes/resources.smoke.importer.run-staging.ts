import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { guardSmokeRoute } from '../lib/smokes.server'

// Returns staging counts for a run or supplier.
// Query params:
// - runId: string (preferred)
// - supplierId: string (fallback if runId missing)
// Response: { ok: true, supplierId, total }
export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')
  let supplierId = url.searchParams.get('supplierId') || ''

  if (runId) {
    const run = await prisma.importRun.findUnique({ where: { id: runId }, select: { supplierId: true } })
    if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })
    supplierId = run.supplierId
  }
  if (!supplierId) return json({ ok: false, error: 'Missing supplierId' }, { status: 400 })

  const total = await prisma.partStaging.count({ where: { supplierId } })
  return json({ ok: true, supplierId, total })
}

export const handle = { private: true }
