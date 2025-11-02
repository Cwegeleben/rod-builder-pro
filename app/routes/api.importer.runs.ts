// <!-- BEGIN RBP GENERATED: importer-publish-stage-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import { getTargetById } from '../server/importer/sites/targets'

type ReqBody = { templateId?: unknown; action?: unknown }

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000)
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let body: ReqBody = {}
  try {
    body = (await request.json()) as ReqBody
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = typeof body.templateId === 'string' ? body.templateId : ''
  const action = typeof body.action === 'string' ? body.action : ''
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })
  if (action !== 'stage-latest') return json({ error: 'unsupported action' }, { status: 400 })

  // Resolve supplierId from ImportTemplate settings.target via known targets
  const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
  const cfg = (tpl?.importConfig as Record<string, unknown>) || {}
  const settings = (cfg['settings'] as Record<string, unknown>) || {}
  const targetId = typeof settings['target'] === 'string' ? (settings['target'] as string) : ''
  const target = getTargetById(targetId)
  const supplierId = target?.siteId || targetId || templateId

  // Idempotency window: if a staged run exists in the last 5 minutes, reuse it
  const existing = await prisma.importRun.findFirst({
    where: { supplierId, status: 'staged', startedAt: { gt: minutesAgo(5) } },
    orderBy: { startedAt: 'desc' },
  })
  if (existing) {
    // Return counts from summary if present
    const sums = ((existing.summary as unknown as { counts?: Record<string, number> }) || {}).counts || {}
    const totals = {
      adds: sums.add || 0,
      changes: sums.change || 0,
      nochanges: sums.nochange || 0,
      conflicts: sums.conflict || 0,
      deletes: sums.delete || 0,
    }
    return json({ ok: true, runId: existing.id, totals })
  }

  // Reuse existing diff pipeline to compute deltas and materialize ImportDiff; then mark run as staged
  const { diffStagingToCanonical } = await import('../../packages/importer/src/pipelines/diff')
  const runId = await diffStagingToCanonical(supplierId)

  // Compute totals from ImportDiff for this run
  const diffs = await prisma.importDiff.findMany({ where: { importRunId: runId } })
  const counts = { adds: 0, changes: 0, nochanges: 0, conflicts: 0, deletes: 0 }
  for (const d of diffs) {
    if (d.diffType === 'add') counts.adds += 1
    else if (d.diffType === 'change') counts.changes += 1
    else if (d.diffType === 'delete') counts.deletes += 1
  }

  // Mark as staged and store counts in summary
  const summary: { counts: { adds: number; changes: number; nochanges: number; conflicts: number; deletes: number } } =
    {
      counts,
    }
  await prisma.importRun.update({
    where: { id: runId },
    data: { status: 'staged', summary },
  })

  return json({ ok: true, runId, totals: counts })
}
// <!-- END RBP GENERATED: importer-publish-stage-v1 -->
