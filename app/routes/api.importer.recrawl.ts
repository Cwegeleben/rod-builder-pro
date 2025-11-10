import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

/**
 * Update-all recrawl orchestrator.
 * POST JSON: { templateId?: string, supplierId?: string, approveAdds?: boolean, publish?: boolean, dryRun?: boolean }
 * Behavior:
 *  - Starts a prepare run for the template/supplier (re-uses /api/importer/prepare via function import)
 *  - When prepare stages a review (status 'staged'), optionally auto-approves all adds
 *  - Optionally triggers publish (respecting dryRun) and returns publish totals
 * Returns: { ok, runId, queued?: boolean, publish?: { totals, totalsDetailed? } }
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const templateId = typeof body.templateId === 'string' ? (body.templateId as string) : ''
  const supplierIdInput = typeof body.supplierId === 'string' ? (body.supplierId as string) : ''
  const approveAdds = Boolean(body.approveAdds)
  const doPublish = Boolean(body.publish)
  const dryRun = Boolean(body.dryRun)
  if (!templateId && !supplierIdInput) return json({ error: 'templateId or supplierId required' }, { status: 400 })

  const { prisma } = await import('../db.server')
  // Concurrency & rate-limit guards: avoid starting when template has active prepare/publish or recent recrawl
  if (templateId) {
    try {
      const tpl = await prisma.importTemplate.findUnique({
        where: { id: templateId },
        select: { preparingRunId: true },
      })
      if (tpl?.preparingRunId) {
        return json(
          {
            error: 'Recrawl blocked: a prepare run is already active for this template',
            code: 'blocked_prepare',
            hint: 'Wait for current prepare to finish before starting a new recrawl.',
          },
          { status: 409 },
        )
      }
      const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const activePub = await prisma.importLog.findFirst({
        where: { templateId, type: 'publish:progress', at: { gte: recent } },
        select: { id: true },
      })
      if (activePub) {
        return json(
          {
            error: 'Recrawl blocked: a publish appears to be in progress',
            code: 'blocked_publish',
            hint: 'Let the current publish complete before starting a new recrawl.',
          },
          { status: 409 },
        )
      }
      // Rate limit: disallow more than 1 successful recrawl:start in last 2 minutes
      const recentRecrawl = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const recentRc = await prisma.importLog.findFirst({
        where: { templateId, type: 'recrawl:start', at: { gte: recentRecrawl } },
        select: { id: true },
      })
      if (recentRc) {
        return json(
          {
            error: 'Recrawl blocked: rate limit (try again shortly)',
            code: 'rate_limit',
            retryAfterSeconds: 120,
            hint: 'Avoid rapid consecutive recrawls; allow indexing to finish before re-running.',
          },
          { status: 429 },
        )
      }
    } catch {
      /* best-effort guard */
    }
  }
  // Resolve supplierId from template if needed
  let supplierId = supplierIdInput
  if (!supplierId && templateId) {
    try {
      const row = await prisma.importTemplate.findUnique({ where: { id: templateId }, select: { importConfig: true } })
      const cfg = (row?.importConfig as Record<string, unknown> | null) || null
      const settings = (cfg?.['settings'] as Record<string, unknown> | null) || null
      const targetId = typeof settings?.['target'] === 'string' ? (settings?.['target'] as string) : ''
      if (targetId) {
        const { getTargetById } = await import('../server/importer/sites/targets')
        const t = getTargetById(targetId)
        supplierId = (t?.siteId as string) || targetId
      }
    } catch {
      /* ignore */
    }
  }

  // Kick prepare (reusing internal logic)
  const { action: prepareAction } = await import('./api.importer.prepare')
  const prepReq = new Request(new URL('/api/importer/prepare', request.url).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId }),
  })
  const prepResp = await prepareAction({ request: prepReq } as unknown as ActionFunctionArgs)
  const prepJson = (await prepResp.json()) as unknown
  const prep: Record<string, unknown> =
    prepJson && typeof prepJson === 'object' ? (prepJson as Record<string, unknown>) : {}
  const hasRunId = typeof prep.runId === 'string' && (prep.runId as string).length > 0
  const queued: boolean = Boolean(prep.queued)
  if (!hasRunId && !queued) {
    const errMsg =
      typeof (prep as { error?: unknown }).error === 'string'
        ? ((prep as { error?: string }).error as string)
        : 'Prepare failed'
    return json({ ok: false, error: errMsg, code: 'prepare_failed' }, { status: prepResp.status || 500 })
  }
  const runId: string = String(prep.runId || '')

  // Log recrawl:start
  try {
    if (templateId && runId) {
      await prisma.importLog.create({
        data: { templateId, runId, type: 'recrawl:start', payload: { approveAdds, doPublish, dryRun } },
      })
    }
  } catch {
    /* ignore */
  }

  // If queued, return immediately with runId; downstream systems will start it later
  if (queued) return json({ ok: true, runId, queued: true })

  // Wait for prepare to stage (poll minimal status via DB)
  async function waitForStage(timeoutMs = 60_000, intervalMs = 1000): Promise<'staged' | 'failed' | 'timeout'> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const r = await prisma.importRun.findUnique({ where: { id: runId }, select: { status: true } })
        const s = (r?.status || '').toLowerCase()
        if (s === 'staged' || s === 'ready_to_approve' || s === 'ready-to-approve') return 'staged'
        if (s === 'failed') return 'failed'
      } catch {
        // ignore
      }
      await new Promise(res => setTimeout(res, intervalMs))
    }
    return 'timeout'
  }

  const stageState = await waitForStage()
  if (stageState === 'failed')
    return json({ ok: false, runId, error: 'Prepare failed', code: 'prepare_failed' }, { status: 500 })
  if (stageState === 'timeout')
    return json({ ok: true, runId, queued: false, note: 'Prepare still running', code: 'prepare_timeout' })

  // Optional: auto-approve adds
  let goal: number | undefined
  if (approveAdds) {
    try {
      await prisma.importDiff.updateMany({
        where: { importRunId: runId, diffType: 'add' },
        data: { resolution: 'approve' },
      })
      await prisma.importRun.update({ where: { id: runId }, data: { status: 'ready_to_publish' } })
      if (templateId) {
        try {
          const addCount = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'add' } })
          await prisma.importLog.create({
            data: {
              templateId,
              runId,
              type: 'recrawl:approve-adds',
              payload: { count: addCount } as unknown as import('@prisma/client').Prisma.InputJsonValue,
            },
          })
        } catch {
          /* ignore log failure */
        }
      }
      // Goal: approved items that will be published
      goal = await prisma.importDiff.count({ where: { importRunId: runId, resolution: 'approve' } })
    } catch {
      /* ignore */
    }
  }

  // Optional: publish
  if (doPublish) {
    const { action: publishAction } = await import('./api.importer.runs.$runId.publish.shopify')
    const pubReq = new Request(new URL(`/api/importer/runs/${runId}/publish/shopify`, request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    })
    const pubResp = await publishAction({ request: pubReq, params: { runId } } as unknown as ActionFunctionArgs)
    const pubRaw = await pubResp.json()
    const pubObj: Record<string, unknown> =
      pubRaw && typeof pubRaw === 'object' ? (pubRaw as Record<string, unknown>) : {}
    const pubError = !pubResp.ok
      ? typeof (pubObj as { error?: unknown }).error === 'string'
        ? ((pubObj as { error?: string }).error as string)
        : 'Publish failed'
      : undefined
    if (pubError) {
      return json({ ok: false, runId, goal, publish: pubObj, error: pubError, code: 'publish_failed' }, { status: 500 })
    }
    try {
      if (templateId) {
        await prisma.importLog.create({
          data: {
            templateId,
            runId,
            type: 'recrawl:publish:done',
            payload: pubObj as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        })
      }
    } catch {
      /* ignore log failure */
    }
    return json({ ok: true, runId, queued: false, goal, publish: pubObj })
  }

  return json({ ok: true, runId, queued: false, goal, code: 'recrawl_done' })
}

export default function RecrawlApi() {
  return null
}
