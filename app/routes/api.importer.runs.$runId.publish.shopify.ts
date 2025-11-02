// <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import type { Prisma } from '@prisma/client'
import { publishRunToShopify } from '../services/importer/publishShopify.server'

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const dryRun = Boolean(body?.dryRun)

  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })

  // Preconditions: no conflicts and at least one approved
  const [conflicts, approved] = await Promise.all([
    prisma.importDiff.count({ where: { importRunId: runId, diffType: 'conflict' } }),
    prisma.importDiff.count({ where: { importRunId: runId, resolution: 'approve' } }),
  ])
  if (conflicts > 0) return json({ ok: false, error: 'Resolve conflicts before publishing' }, { status: 400 })
  if (approved === 0) return json({ ok: false, error: 'No approved items to publish' }, { status: 400 })

  const { totals, productIds } = await publishRunToShopify({ runId, dryRun: dryRun || true })

  // Store summary under run.summary.publish
  const summary = (run.summary as unknown as Record<string, unknown>) || {}
  summary.publish = { totals, at: new Date().toISOString() }
  await prisma.importRun.update({
    where: { id: runId },
    data: { status: 'published', summary: summary as unknown as Prisma.InputJsonValue },
  })

  const filter = { tag: `importRun:${runId}` }
  return json({ ok: true, runId, totals, productIds, filter }, { headers: { 'Cache-Control': 'no-store' } })
}

export default function PublishRunShopifyApi() {
  return null
}
// <!-- END RBP GENERATED: importer-publish-shopify-v1 -->
