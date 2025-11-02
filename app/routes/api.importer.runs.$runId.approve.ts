// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : []
  if (!ids.length) return json({ ok: true, approvedCount: 0 })
  const result = await prisma.importDiff.updateMany({
    where: { importRunId: runId, id: { in: ids } },
    data: { resolution: 'approve', resolvedAt: new Date() },
  })
  return json({ ok: true, approvedCount: result.count })
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
