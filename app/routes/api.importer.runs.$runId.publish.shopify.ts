// <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { authenticate } from '../shopify.server'
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

  // Mark as publishing so status endpoint can reflect running state
  await prisma.importRun.update({ where: { id: runId }, data: { status: 'publishing' } })

  try {
    // Prefer the installed shop domain from the current admin session when available
    let sessionShop: string | undefined
    try {
      const { session } = await authenticate.admin(request)
      sessionShop = (session as unknown as { shop?: string }).shop || undefined
    } catch {
      sessionShop = undefined
    }
    const { totals, totalsDetailed, productIds, shopDomain } = await publishRunToShopify({
      runId,
      dryRun,
      shopDomain: sessionShop,
    })

    // Store summary under run.summary.publish
    const summary = (run.summary as unknown as Record<string, unknown>) || {}
    summary.publish = { totals, totalsDetailed, at: new Date().toISOString(), shop: shopDomain || sessionShop || null }
    await prisma.importRun.update({
      where: { id: runId },
      data: { status: 'published', summary: summary as unknown as Prisma.InputJsonValue },
    })

    const filter = { tag: `importRun:${runId}` }
    return json(
      { ok: true, runId, totals, totalsDetailed, productIds, filter },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' &&
            err &&
            'message' in err &&
            typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Publish failed'
    // Best-effort: record failure in run.summary.publishError and reset status
    try {
      const current = await prisma.importRun.findUnique({ where: { id: runId } })
      const summary = (current?.summary as unknown as Record<string, unknown>) || {}
      summary.publishError = { message, at: new Date().toISOString() }
      await prisma.importRun.update({
        where: { id: runId },
        data: { status: 'review', summary: summary as unknown as Prisma.InputJsonValue },
      })
      // Also best-effort: append a publish:error log so it appears in Recent runs
      try {
        const snap = await prisma.runMappingSnapshot.findUnique({ where: { runId } })
        const templateId = snap?.templateId
        if (templateId) {
          await prisma.importLog.create({
            data: { templateId, runId, type: 'publish:error', payload: { message } },
          })
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    return json({ ok: false, error: message }, { status: 500 })
  }
}

export default function PublishRunShopifyApi() {
  return null
}
// <!-- END RBP GENERATED: importer-publish-shopify-v1 -->
