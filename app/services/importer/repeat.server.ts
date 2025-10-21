// <!-- BEGIN RBP GENERATED: hq-repeat-scrape-services-v1 -->
import { prisma } from '../../db.server'
import { normalizeUrl } from '../../../packages/importer/src/lib/url'

/**
 * Build a combined URL set from selected runs.
 * Current implementation uses add/change diffs for those runs and looks up their ProductSource URLs.
 * If prior failures are tracked via resolution (e.g., 'reject'), we flag those URLs.
 */
export async function buildCombinedUrlSet(runIds: string[], supplierId = 'batson') {
  if (!runIds.length) return { urls: [] as string[], flaggedFailures: [] as string[] }

  // Collect externalIds referenced in add/change diffs for the selected runs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const diffs = await db.importDiff.findMany({
    where: { importRunId: { in: runIds }, diffType: { in: ['add', 'change'] } },
    select: { externalId: true, resolution: true },
  })
  const okExt = new Set<string>()
  const failExt = new Set<string>()
  for (const d of diffs) {
    if (d.resolution === 'reject') failExt.add(d.externalId)
    okExt.add(d.externalId)
  }

  if (okExt.size === 0) return { urls: [], flaggedFailures: [] }

  // Map externalIds -> ProductSource urls
  const sources = await db.productSource.findMany({
    where: { supplierId, externalId: { in: Array.from(okExt) } },
    select: { url: true, externalId: true },
  })

  // Normalize + dedupe
  const dedup = new Set<string>()
  const flaggedFailures: string[] = []
  for (const s of sources) {
    const n = normalizeUrl(s.url)
    if (!n) continue
    if (!dedup.has(n)) dedup.add(n)
    if (s.externalId && failExt.has(s.externalId)) flaggedFailures.push(n)
  }

  return { urls: Array.from(dedup), flaggedFailures }
}

/**
 * Persist a "repeat scrape" set and schedule (price_avail only).
 * - Ensures ProductSource entries exist for each url, tagged as 'scheduled:<groupId>'.
 * - Creates or updates ImportSchedule (enabled) for the supplier/profile.
 */
export async function saveRepeatSet(supplierId: string, urls: string[], cron: string) {
  const groupId = `sched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any

  // Upsert ProductSource rows tagged as scheduled group
  for (const raw of urls) {
    const n = normalizeUrl(raw)
    if (!n) continue
    await db.productSource.upsert({
      where: { product_source_supplier_url_unique: { supplierId, url: n } },
      update: { lastSeenAt: now, source: `scheduled:${groupId}` },
      create: { supplierId, url: n, source: `scheduled:${groupId}`, firstSeenAt: now, lastSeenAt: now },
    })
  }

  // Upsert-like for ImportSchedule (no composite unique in schema; emulate upsert)
  const existing = await db.importSchedule.findFirst({ where: { supplierId, profile: 'price_avail' } })
  if (existing) {
    await db.importSchedule.update({ where: { id: existing.id }, data: { enabled: true, cron, nextDueAt: null } })
  } else {
    await db.importSchedule.create({ data: { supplierId, enabled: true, cron, profile: 'price_avail' } })
  }

  return { ok: true as const, groupId }
}
// <!-- END RBP GENERATED: hq-repeat-scrape-services-v1 -->
