// <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 -->
import { prisma } from '../../db.server'

export type PublishTotals = { created: number; updated: number; skipped: number; failed: number }
export type PublishResult = { totals: PublishTotals; productIds: string[] }

/**
 * Dry-run publisher: iterates approved diffs for a run and computes totals without hitting Shopify.
 * Next steps: wire Shopify Admin client, idempotency headers, tagging & metafields, and back-write per item.
 */
export async function publishRunToShopify({
  runId,
  dryRun = true,
}: {
  runId: string
  dryRun?: boolean
}): Promise<PublishResult> {
  // Count approved items and simulate create/update split using diffType
  const approved = await prisma.importDiff.findMany({
    where: { importRunId: runId, resolution: 'approve' },
    select: { id: true, diffType: true },
  })
  let created = 0
  let updated = 0
  for (const d of approved) {
    if (d.diffType === 'add') created += 1
    else if (d.diffType === 'change' || d.diffType === 'delete') updated += 1
    else {
      // Conflicts should be zero by preconditions; treat any others as skipped
    }
  }
  const totals: PublishTotals = { created, updated, skipped: 0, failed: 0 }
  const productIds: string[] = []
  // In dryRun, we do not call Shopify nor back-write; return computed totals only
  if (dryRun) return { totals, productIds }

  // Real publish (next iteration):
  // 1) Load each approved row's mapped payload from `after` JSON
  // 2) Compute idempotencyKey
  // 3) Upsert: find by shopifyProductId or externalId metafield, else create
  // 4) Tag with import:{targetSlug}, importRun:{runId}; write metafields
  // 5) Back-write per-row result and accumulate productIds & totals

  return { totals, productIds }
}
// <!-- END RBP GENERATED: importer-publish-shopify-v1 -->
