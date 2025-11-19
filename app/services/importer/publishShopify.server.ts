// <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 -->
import { getShopAccessToken } from '../shopifyAdmin.server'
import { upsertShopifyForRun } from '../../../packages/importer/src/sync/shopify'

export type PublishTotals = { created: number; updated: number; skipped: number; failed: number }
export type PublishDetailedTotals = {
  created: number
  updated: number
  unchanged_active: number
  unchanged_specs_backfilled: number
  hash_unchanged_title_updated: number
  hash_unchanged_specs_backfilled: number
  failed: number
}
export type PublishResult = {
  totals: PublishTotals
  totalsDetailed?: PublishDetailedTotals
  productIds: string[]
  shopDomain?: string
  diag?: Record<string, unknown>
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
  const { prisma } = await import('../../db.server')
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
    select: { id: true, diffType: true, externalId: true },
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
    // Log publish:start with diagnostic counts
    const counts = approved.reduce(
      (acc, d) => {
        acc[d.diffType as 'add' | 'change' | 'delete'] = (acc[d.diffType as 'add' | 'change' | 'delete'] || 0) + 1
        return acc
      },
      { add: 0, change: 0, delete: 0 } as Record<'add' | 'change' | 'delete', number>,
    )
    if (templateId) {
      await prisma.importLog.create({
        data: {
          templateId,
          runId,
          type: 'publish:start',
          payload: { dryRun: !!dryRun, target, counts },
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
      // Emit publish:progress log for visibility
      if (templateId) {
        try {
          await prisma.importLog.create({
            data: {
              templateId,
              runId,
              type: 'publish:progress',
              payload: { processed, target, pct: target > 0 ? Math.round((processed / target) * 100) : 0 },
            },
          })
        } catch {
          /* ignore */
        }
      }
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
  // Guard: duplication/leakage heuristic — if distinct externalIds are too low, block real publish
  try {
    if (!dryRun && target >= 10) {
      const distinctExternalIds = new Set(approved.map(a => a.externalId)).size
      const ratio = target > 0 ? distinctExternalIds / target : 1
      const threshold = 0.5 // configurable heuristic
      if (ratio < threshold) {
        if (templateId) {
          await prisma.importLog.create({
            data: {
              templateId,
              runId,
              type: 'publish:guard:block',
              payload: { reason: 'low-distinct-externalIds', target, distinctExternalIds, ratio, threshold },
            },
          })
        }
        return {
          totals: { created: 0, updated: 0, skipped: target, failed: 0 },
          productIds: [],
          diag: { reason: 'guard-blocked', distinctExternalIds, target, ratio, threshold },
        }
      }
    }
  } catch {
    /* ignore guard logging errors */
  }
  // In dryRun, we do not call Shopify nor back-write; log done and return computed totals only
  if (dryRun) {
    try {
      if (templateId) {
        await prisma.importLog.create({
          data: { templateId, runId, type: 'publish:done', payload: { totals, dryRun: true } },
        })
      }
    } catch {
      /* ignore */
    }
    return { totals, productIds }
  }

  // Real publish phase 1: create/update in Shopify
  // Determine shop domain: prefer explicit env override, else first offline session shop
  // Determine target shop domain: prefer explicitly provided value (from session),
  // then env overrides, then first offline session as fallback.
  let shopDomain = shopDomainInput || process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
  if (!shopDomain) {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    if (sess?.shop) shopDomain = sess.shop
  }

  // Log publish:attempt when proceeding with a real publish
  try {
    if (templateId) {
      await prisma.importLog.create({
        data: {
          templateId,
          runId,
          type: 'publish:attempt',
          payload: { shopDomain, target },
        },
      })
    }
  } catch {
    /* ignore */
  }
  if (!shopDomain) {
    // Fallback: treat as no-op publish but keep totals from dry estimate
    // Log publish:done with dry totals and diagnostic reason so UI can surface configuration issue
    try {
      if (templateId) {
        await prisma.importLog.create({
          data: {
            templateId,
            runId,
            type: 'publish:done',
            payload: {
              totals,
              diag: {
                reason: 'no-shop-domain',
                hint: 'Ensure a shop session or SHOP env var is configured before real publish.',
              },
            },
          },
        })
      }
    } catch {
      /* ignore */
    }
    return { totals, productIds, shopDomain: undefined, diag: { reason: 'no-shop-domain' } }
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
  const rawUpdatedCount = results.filter(r => r.action === 'updated').length
  // Adjust updated count: exclude hash-unchanged-* skipReason variants (title-only / specs-backfilled without content change)
  let hashUnchangedTitle = 0
  let hashUnchangedSpecs = 0
  try {
    // NOTE: We search for publish.skipReason markers inside validation JSON text column.
    const [titleRows, specsRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'SELECT COUNT(1) as c FROM ImportDiff WHERE importRunId = ? AND validation LIKE \'%"publish"%\' AND validation LIKE \'%"skipReason":"hash-unchanged-title-updated"%\'',
        runId,
      ),
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'SELECT COUNT(1) as c FROM ImportDiff WHERE importRunId = ? AND validation LIKE \'%"publish"%\' AND validation LIKE \'%"skipReason":"hash-unchanged-specs-backfilled"%\'',
        runId,
      ),
    ])
    hashUnchangedTitle = Number(titleRows?.[0]?.c || 0)
    hashUnchangedSpecs = Number(specsRows?.[0]?.c || 0)
  } catch {
    hashUnchangedTitle = 0
    hashUnchangedSpecs = 0
  }
  const updatedAdjusted = Math.max(0, rawUpdatedCount - hashUnchangedTitle - hashUnchangedSpecs)
  const skippedCount = Math.max(0, target - (createdCount + rawUpdatedCount + failed))
  const finalTotals: PublishTotals = {
    created: createdCount,
    updated: updatedAdjusted,
    skipped: skippedCount,
    failed,
  }
  // Warn if no results despite target>0
  if (target > 0 && createdCount + updatedAdjusted === 0) {
    try {
      if (templateId) {
        await prisma.importLog.create({
          data: {
            templateId,
            runId,
            type: 'publish:attempt:no_results',
            payload: { target },
          },
        })
        const sampleIds = approved.slice(0, 5).map(d => d.id)
        await prisma.importLog.create({
          data: {
            templateId,
            runId,
            type: 'publish:warn',
            payload: { reason: 'no-results', target, sampleApprovedIds: sampleIds },
          },
        })
      }
    } catch {
      /* ignore */
    }
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
  // Hash unchanged counts captured earlier (title/specs backfilled while hash unchanged)
  const totalsDetailed: PublishDetailedTotals = {
    created: createdCount,
    updated: updatedAdjusted,
    unchanged_active: unchangedActive,
    unchanged_specs_backfilled: unchangedSpecs,
    hash_unchanged_title_updated: hashUnchangedTitle,
    hash_unchanged_specs_backfilled: hashUnchangedSpecs,
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
