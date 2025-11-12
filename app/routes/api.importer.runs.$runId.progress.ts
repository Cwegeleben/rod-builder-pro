import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = params.runId || ''
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const { prisma } = await import('../db.server')
  try {
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return json({ error: 'Not found' }, { status: 404 })
    const progress = (run.progress as unknown as Record<string, unknown>) || {}
    type ProgressShape = { etaSeconds?: number; details?: { seedIndex?: number; seedsTotal?: number } }
    const p = progress as ProgressShape
    const seedIndex = typeof p.details?.seedIndex === 'number' ? p.details?.seedIndex : undefined
    const seedsTotal = typeof p.details?.seedsTotal === 'number' ? p.details?.seedsTotal : undefined
    const etaSeconds = typeof p.etaSeconds === 'number' ? p.etaSeconds : undefined
    const summary = (run.summary as unknown as Record<string, unknown>) || {}
    const lastUpdated =
      typeof (progress as Record<string, unknown>)['lastUpdated'] === 'string'
        ? ((progress as Record<string, unknown>)['lastUpdated'] as string)
        : undefined
    let stuck = false
    if (!run.finishedAt && run.status !== 'staged' && run.status !== 'failed' && run.status !== 'cancelled') {
      if (lastUpdated) {
        const ageMs = Date.now() - new Date(lastUpdated).getTime()
        if (ageMs > 120_000) stuck = true
      }
      // Also consider DB status set to 'stuck'
      if (run.status === 'stuck') stuck = true
    }
    return json({
      ok: true,
      runId,
      status: run.status,
      progress,
      summary,
      finished: Boolean(run.finishedAt),
      seedIndex,
      seedsTotal,
      etaSeconds,
      stuck,
      lastUpdated,
      startedAt: run.startedAt,
    })
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Failed to load progress' }, { status: 500 })
  }
}

export default function ImportRunProgress() {
  return null
}
