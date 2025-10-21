// <!-- BEGIN RBP GENERATED: importer-diff-with-skip-v1 -->
import { prisma } from '../db'

/**
 * Mark diffs in the given run as "skip-successful" when their externalIds
 * have already been successfully processed in past runs.
 *
 * Since we don't persist a dedicated sync_status field yet, we treat
 * previously approved add/change diffs as "successful" history.
 */
export async function markSkipSuccessfulForRun(supplierId: string, runId: string) {
  // Collect history of approved externalIds for this supplier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const history = (await db.importDiff.findMany({
    where: { diffType: { in: ['add', 'change'] }, resolution: 'approve' },
    select: { externalId: true },
  })) as Array<{ externalId: string }>
  if (!history.length) return { changed: 0 }
  const extSet = Array.from(new Set(history.map(h => h.externalId)))

  // Mark current run rows that match history as skipped
  const result = await db.importDiff.updateMany({
    where: { importRunId: runId, externalId: { in: extSet } },
    data: { resolution: 'skip-successful', resolvedAt: new Date() },
  })
  return { changed: Number(result?.count || 0) }
}
// <!-- END RBP GENERATED: importer-diff-with-skip-v1 -->
