import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import { startNextQueuedForTemplate } from '../services/importer/orchestrator.server'

// POST /api/importer/maintenance/cleanup
// Scans templates with an attached preparingRunId and clears stale slots (missing or terminal runs), then promotes queued runs.
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  const terminalStatuses = new Set(['staged', 'failed', 'cancelled', 'stuck', 'success'])
  const templates = await prisma.importTemplate.findMany({
    where: { preparingRunId: { not: null } },
    select: { id: true, preparingRunId: true },
  })

  const details: Array<{
    templateId: string
    runId: string
    reason: string
    runStatus: string | null
    promoted: boolean
  }> = []
  let cleared = 0

  for (const tpl of templates) {
    const runId = tpl.preparingRunId!
    let runStatus: string | null = null
    let reason = 'active'
    try {
      const run = await prisma.importRun.findUnique({ where: { id: runId } })
      if (!run) {
        reason = 'missingRun'
      } else {
        runStatus = run.status
        if (terminalStatuses.has(run.status)) reason = 'terminal'
      }
    } catch {
      reason = 'lookupError'
    }

    if (reason === 'terminal' || reason === 'missingRun' || reason === 'lookupError') {
      try {
        await prisma.importTemplate.update({ where: { id: tpl.id }, data: { preparingRunId: null } })
        await prisma.importLog.create({
          data: {
            templateId: tpl.id,
            runId,
            type: 'maintenance:slot-cleared',
            payload: { reason, runStatus },
          },
        })
        cleared++
        let promoted = false
        try {
          await startNextQueuedForTemplate(tpl.id)
          promoted = true
        } catch {
          /* ignore promotion errors */
        }
        details.push({ templateId: tpl.id, runId, reason, runStatus, promoted })
      } catch {
        details.push({ templateId: tpl.id, runId, reason: 'clearFailed', runStatus, promoted: false })
      }
    }
  }

  return json({ ok: true, inspected: templates.length, cleared, details }, { headers: { 'Cache-Control': 'no-store' } })
}

export default function ImporterMaintenanceCleanup() {
  return null
}
