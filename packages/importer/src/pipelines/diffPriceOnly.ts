// <!-- BEGIN RBP GENERATED: importer-price-diff-v1 -->
import { prisma } from '../db'

export type PriceFields = {
  priceMsrp: number | null
  priceWh: number | null
  availability: string | null
}

/**
 * Create a price/availability-only ImportRun and ImportDiff rows for a supplier.
 * - Only 'change' diffs for rows present in both canonical (Part) and staging
 * - changed fields limited to priceMsrp, priceWh, availability
 * - No adds/deletes
 */
export async function diffPriceOnly(supplierId: string) {
  // Check if Part table exists (canonical); if not, nothing to diff
  const partsTable = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Part'`,
  )
  if (!partsTable.length) return null

  // Load canonical parts mapped by externalId
  const canonical: Array<{
    externalId: string
    priceMsrp: number | null
    priceWh: number | null
    availability: string | null
  }> = await prisma.$queryRawUnsafe(
    `SELECT externalId, priceMsrp, priceWh, availability FROM Part WHERE supplierId = ?`,
    supplierId,
  )
  const byExt = new Map(canonical.map(p => [p.externalId, p]))

  // Load staging rows for supplier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const staging = await db.partStaging.findMany({ where: { supplierId } })

  // Compute diffs
  type Minimal = Partial<PriceFields>
  const diffs: Array<{ externalId: string; before: Minimal; after: Minimal }> = []

  for (const s of staging) {
    const c = byExt.get(s.externalId)
    if (!c) continue // do not include adds

    const before: Minimal = {}
    const after: Minimal = {}

    const msrpChanged = (c.priceMsrp ?? null) !== (s.priceMsrp as unknown as number | null)
    const whChanged = (c.priceWh ?? null) !== (s.priceWh as unknown as number | null)
    const avail = ((s.rawSpecs as unknown as { availability?: string })?.availability ?? null) as string | null
    const availChanged = (c.availability ?? null) !== avail

    if (msrpChanged) {
      before.priceMsrp = c.priceMsrp ?? null
      after.priceMsrp = (s.priceMsrp as unknown as number | null) ?? null
    }
    if (whChanged) {
      before.priceWh = c.priceWh ?? null
      after.priceWh = (s.priceWh as unknown as number | null) ?? null
    }
    if (availChanged) {
      before.availability = c.availability ?? null
      after.availability = avail
    }

    if (Object.keys(before).length) {
      diffs.push({ externalId: s.externalId, before, after })
    }
  }

  if (!diffs.length) return null

  const run = await db.importRun.create({
    data: {
      supplierId,
      status: 'success',
      summary: { type: 'price_avail', counts: { change: diffs.length } } as unknown as object,
    },
  })
  await db.importDiff.createMany({
    data: diffs.map(d => ({
      importRunId: run.id,
      externalId: d.externalId,
      diffType: 'change',
      before: d.before as unknown as object,
      after: d.after as unknown as object,
    })),
  })
  return run.id
}
// <!-- END RBP GENERATED: importer-price-diff-v1 -->
