import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'

// POST /api/importer/runs/:runId/cancel
export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })

  try {
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return json({ error: 'Not found' }, { status: 404 })
    const summary = (run.summary as unknown as Record<string, unknown>) || {}
    const control = { ...(summary['control'] as Record<string, unknown> | undefined) }
    control['cancelRequested'] = true
    const next = { ...summary, control }
    await prisma.importRun.update({ where: { id: runId }, data: { summary: next as unknown as object } })
    await prisma.importLog.create({ data: { templateId: 'n/a', runId, type: 'prepare:cancel', payload: {} } })
    return json({ ok: true })
  } catch (err) {
    return json({ error: (err as Error)?.message || 'cancel failed' }, { status: 500 })
  }
}

export default function ImportRunCancelApi() {
  return null
}
