// <!-- BEGIN RBP GENERATED: importer-publish-status-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { smokesEnabled, extractSmokeToken } from '../lib/smokes.server'
import { prisma } from '../db.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Allow optional diagnostic bypass when explicitly enabled and token provided
  let bypass = false
  let tokenOk = false
  let diagFlag = false
  let smokes = false
  try {
    const url = new URL(request.url)
    diagFlag = url.searchParams.get('diag') === '1'
    smokes = smokesEnabled()
    if (diagFlag && smokes) {
      const tok = extractSmokeToken(request)
      const expected = process.env.SMOKE_TOKEN || 'smoke-ok'
      tokenOk = Boolean(tok && tok === expected)
      if (tokenOk) bypass = true
    }
  } catch {
    /* ignore */
  }
  if (!bypass) await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })

  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })

  const state = run.status as string
  const totalApproved = await prisma.importDiff.count({ where: { importRunId: runId, resolution: 'approve' } })

  // If publish summary exists, treat as completed and derive totals
  const summary = (run.summary as unknown as Record<string, unknown>) || {}
  const publishSummary = (
    summary as unknown as {
      publish?: { totals?: { created: number; updated: number; skipped: number; failed: number }; at?: string }
    }
  ).publish
  const progressBlob = (
    summary as unknown as {
      publishProgress?: { processed?: number; target?: number; startedAt?: string; updatedAt?: string }
    }
  ).publishProgress
  const completed = Boolean(publishSummary?.totals)

  const totals = publishSummary?.totals ?? { created: 0, updated: 0, skipped: 0, failed: 0 }
  // Prefer live processed/target from summary.publishProgress while publishing
  const processedLive = typeof progressBlob?.processed === 'number' ? progressBlob.processed : 0
  const targetLive = typeof progressBlob?.target === 'number' ? progressBlob.target : totalApproved
  const processed = completed ? totals.created + totals.updated + totals.skipped + totals.failed : processedLive
  const target = completed ? totals.created + totals.updated + totals.skipped + totals.failed : targetLive
  const rawPct = target > 0 ? Math.floor((processed / target) * 100) : 0
  const progress = completed ? 100 : Math.max(5, Math.min(95, rawPct || 10))

  // Basic ETA using average throughput since startedAt
  let etaMs: number | null = null
  if (!completed && progressBlob?.startedAt && target > 0) {
    const startedAt = new Date(progressBlob.startedAt).getTime()
    const now = Date.now()
    const elapsedMs = Math.max(1, now - startedAt)
    const ratePerMs = processed / elapsedMs
    const remaining = Math.max(0, target - processed)
    if (ratePerMs > 0 && remaining > 0) etaMs = Math.round(remaining / ratePerMs)
  }

  return json(
    {
      ok: true,
      runId,
      state: completed ? 'published' : state,
      progress,
      target,
      processed,
      totals,
      etaMs,
      // diagnostics
      _diag: { bypass, tokenOk, diagFlag, smokesEnabled: smokes },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Publish-Bypass': String(bypass), 'X-Smokes': String(smokes) } },
  )
}

// Resource route (no default export) so JSON is returned directly
// <!-- END RBP GENERATED: importer-publish-status-v1 -->
