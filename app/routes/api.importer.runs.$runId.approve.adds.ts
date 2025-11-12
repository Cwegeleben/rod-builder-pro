import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import type { Prisma } from '@prisma/client'

// POST /api/importer/runs/:runId/approve/adds
// Approves all 'add' diffs for the run to enable publishing via API/portal.
export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })
  try {
    // Support optional 'all' flag to broaden the set to re-approve non-approved adds.
    // Accept either query param ?all=1 or JSON body { all: true }.
    const url = new URL(request.url)
    const qAll = url.searchParams.get('all') === '1'
    const body = await request.json().catch(() => ({}))
    const bAll = Boolean(body?.all)
    const allFlag = qAll || bAll

    // Counts for diagnostics/UI
    const totalAdds = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'add' } })
    const unresolvedAdds = await prisma.importDiff.count({
      where: { importRunId: runId, diffType: 'add', OR: [{ resolution: null }, { resolution: 'pending' }] },
    })

    const whereBase: Prisma.ImportDiffWhereInput = { importRunId: runId, diffType: 'add' }
    const whereForUpdate: Prisma.ImportDiffWhereInput = allFlag
      ? { ...whereBase, resolution: { not: 'approve' } }
      : { ...whereBase, OR: [{ resolution: null }, { resolution: 'pending' }] }

    const res = await prisma.importDiff.updateMany({
      where: whereForUpdate,
      data: { resolution: 'approve', resolvedAt: new Date() },
    })

    // Log approval action to ImportLog (template-aware best effort)
    try {
      const run = await prisma.importRun.findUnique({ where: { id: runId } })
      const summary = (run?.summary as unknown as { options?: { templateId?: string; notes?: string } }) || {}
      const tpl = summary.options?.templateId || (summary.options?.notes || '').replace(/^prepare:/, '') || 'n/a'
      await prisma.importLog.create({
        data: {
          templateId: tpl,
          runId,
          type: 'review:approve-adds',
          payload: { totals: { totalAdds, unresolvedAdds }, updated: res.count, all: allFlag },
        },
      })
    } catch {
      /* ignore logging failures */
    }

    return json({
      ok: true,
      totals: { totalAdds, unresolvedAdds },
      updated: res.count,
      all: allFlag,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export default function ApproveAddsApi() {
  return null
}
