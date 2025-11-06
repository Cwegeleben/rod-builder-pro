// <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 -->
import { prisma } from '../../db.server'
import { getShopAccessToken } from '../shopifyAdmin.server'
import { upsertShopifyForRun } from '../../../packages/importer/src/sync/shopify'

export type PublishTotals = { created: number; updated: number; skipped: number; failed: number }
export type PublishDetailedTotals = {
  created: number
  updated: number
  unchanged_active: number
  unchanged_specs_backfilled: number
  failed: number
}
export type PublishResult = {
  totals: PublishTotals
  totalsDetailed?: PublishDetailedTotals
  productIds: string[]
  shopDomain?: string
}
export type PublishProgress = { processed: number; target: number; startedAt: string; updatedAt: string }

/**
 * Dry-run publisher: iterates approved diffs for a run and computes totals without hitting Shopify.
 * Next steps: wire Shopify Admin client, idempotency headers, tagging & metafields, and back-write per item.
 */
export async function publishRunToShopify({
  runId,
  dryRun = true,
  shopDomain: shopDomainInput,
}: {
  runId: string
  dryRun?: boolean
  shopDomain?: string
}): Promise<PublishResult> {
  // Resolve templateId for logging (best-effort)
  let templateId: string | null = null
  try {
    const snap = await prisma.runMappingSnapshot.findUnique({ where: { runId } })
    templateId = snap?.templateId || null
  } catch {
    /* ignore */
  }

  // Load approved diffs so we can iterate and emit progress
  const approved = await prisma.importDiff.findMany({
    where: { importRunId: runId, resolution: 'approve' },
    select: { id: true, diffType: true },
  })

  const target = approved.length
  const startedAt = new Date()

  // Initialize publishProgress in ImportRun.summary for the status endpoint
  try {
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    const summary = (run?.summary as unknown as Record<string, unknown>) || {}
    const next = {
      ...(summary || {}),
      publishProgress: {
        processed: 0,
        target,
        startedAt: startedAt.toISOString(),
        updatedAt: startedAt.toISOString(),
      },
    }
    await prisma.importRun.update({
      where: { id: runId },
      data: { summary: next as unknown as import('@prisma/client').Prisma.InputJsonValue },
    })
    // Log publish:start
    if (templateId) {
      await prisma.importLog.create({
        data: {
          templateId,
          runId,
          type: 'publish:start',
          payload: { dryRun: !!dryRun, target },
        },
      })
    }
  } catch {
    // best-effort; status endpoint will still fall back to counts
  }

  let created = 0
  let updated = 0
  let processed = 0
  const productIds: string[] = []

  // Throttle summary update to avoid excessive writes
  let lastWrite = 0
  const writeIntervalMs = 500
  async function writeProgress() {
    const now = Date.now()
    if (now - lastWrite < writeIntervalMs && processed < target) return
    lastWrite = now
    try {
      const run = await prisma.importRun.findUnique({ where: { id: runId } })
      const summary = (run?.summary as unknown as Record<string, unknown>) || {}
      const existingPP = (summary as unknown as { publishProgress?: PublishProgress }).publishProgress
      const pp: PublishProgress = {
        processed,
        target,
        startedAt: existingPP?.startedAt || startedAt.toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const nextSummary: Record<string, unknown> = { ...(summary || {}), publishProgress: pp }
      await prisma.importRun.update({
        where: { id: runId },
        data: {
          summary: nextSummary as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
      })
    } catch {
      // ignore progress write errors
    }
  }

  for (const d of approved) {
    // Simulate per-item processing and compute created/updated split
    if (d.diffType === 'add') created += 1
    else if (d.diffType === 'change' || d.diffType === 'delete') updated += 1
    processed += 1
    await writeProgress()
  }

  // Final progress flush
  await writeProgress()

  const totals: PublishTotals = { created, updated, skipped: 0, failed: 0 }
  // In dryRun, we do not call Shopify nor back-write; return computed totals only
  if (dryRun) return { totals, productIds }

  // Real publish phase 1: create-only upsert for 'add' diffs
  // Determine shop domain: prefer explicit env override, else first offline session shop
  // Determine target shop domain: prefer explicitly provided value (from session),
  // then env overrides, then first offline session as fallback.
  let shopDomain = shopDomainInput || process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
  if (!shopDomain) {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    if (sess?.shop) shopDomain = sess.shop
  }
  if (!shopDomain) {
    // Fallback: treat as no-op publish but keep totals from dry estimate
    // Log publish:done with dry totals
    try {
      if (templateId) {
        await prisma.importLog.create({
          data: { templateId, runId, type: 'publish:done', payload: { totals } },
        })
      }
    } catch {
      /* ignore */
    }
    return { totals, productIds, shopDomain: undefined }
  }

  // Acquire token and perform create-only upsert
  const accessToken = await getShopAccessToken(shopDomain)
  const results = await upsertShopifyForRun(runId, {
    shopName: shopDomain,
    accessToken,
    approvedOnly: true,
    deleteOverride: false,
    addsOnly: false,
  })

  // Compute totals from results (creates + updates) and include failed by scanning per-diff diagnostics
  // Compute failed count by checking diffs with publish.error (best-effort; use raw LIKE for SQLite TEXT JSON)
  let failed = 0
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      'SELECT COUNT(1) as c FROM ImportDiff WHERE importRunId = ? AND validation LIKE \'%"publish"%\' AND validation LIKE \'%"error"%\'',
      runId,
    )
    failed = Number(rows?.[0]?.c || 0)
  } catch {
    failed = 0
  }
  const createdCount = results.filter(r => r.action === 'created').length
  const updatedCount = results.filter(r => r.action === 'updated').length
  const skippedCount = Math.max(0, target - (createdCount + updatedCount + failed))
  const finalTotals: PublishTotals = {
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    failed,
  }
  // Detailed totals: break out unchanged categories by skipReason
  let unchangedActive = 0
  let unchangedSpecs = 0
  try {
    const [unchangedActiveRows, unchangedSpecsRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'SELECT COUNT(1) as c FROM ImportDiff WHERE importRunId = ? AND validation LIKE \'%"publish"%\' AND validation LIKE \'%"skipReason":"unchanged-and-active"%\'',
        runId,
      ),
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'SELECT COUNT(1) as c FROM ImportDiff WHERE importRunId = ? AND validation LIKE \'%"publish"%\' AND validation LIKE \'%"skipReason":"unchanged-specs-backfilled"%\'',
        runId,
      ),
    ])
    unchangedActive = Number(unchangedActiveRows?.[0]?.c || 0)
    unchangedSpecs = Number(unchangedSpecsRows?.[0]?.c || 0)
  } catch {
    unchangedActive = 0
    unchangedSpecs = 0
  }
  const totalsDetailed: PublishDetailedTotals = {
    created: createdCount,
    updated: updatedCount,
    unchanged_active: unchangedActive,
    unchanged_specs_backfilled: unchangedSpecs,
    failed,
  }
  const createdIds = results.map(r => String(r.productId))
  // Log publish:done with final totals
  try {
    if (templateId) {
      await prisma.importLog.create({
        data: {
          templateId,
          runId,
          type: 'publish:done',
          payload: { totals: finalTotals, totalsDetailed, productIds: createdIds },
        },
      })
    }
  } catch {
    /* ignore */
  }
  return { totals: finalTotals, totalsDetailed, productIds: createdIds, shopDomain }
}
// <!-- END RBP GENERATED: importer-publish-shopify-v1 -->
