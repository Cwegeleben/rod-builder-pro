import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'

// POST /api/importer/runs/:runId/approve/adds
// Approves all 'add' diffs for the run to enable publishing via API/portal.
export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })
  try {
    const res = await prisma.importDiff.updateMany({
      where: { importRunId: runId, diffType: 'add', OR: [{ resolution: null }, { resolution: 'pending' }] },
      data: { resolution: 'approve', resolvedAt: new Date() },
    })
    return json({ ok: true, updated: res.count })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export default function ApproveAddsApi() {
  return null
}
