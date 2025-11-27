import { prisma } from '../../db.server'

export type DesignStudioFamilyStats = {
  family: string
  readyCount: number
  needsReviewCount: number
  lastTouchedAt: string | null
}

const canonicalEnabled = () => process.env.PRODUCT_DB_ENABLED === '1'

const toNumber = (value: number | bigint | null | undefined): number => {
  if (typeof value === 'bigint') {
    const coerced = Number(value)
    return Number.isFinite(coerced) ? coerced : Number.MAX_SAFE_INTEGER
  }
  return Number(value ?? 0)
}

export async function loadDesignStudioFamilyStats(): Promise<DesignStudioFamilyStats[]> {
  if (!canonicalEnabled()) {
    return []
  }
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        family: string | null
        readyCount: number | bigint
        reviewCount: number | bigint
        lastTouchedAt: Date | null
      }>
    >`
      SELECT
        designStudioFamily AS family,
        SUM(CASE WHEN designStudioReady = 1 THEN 1 ELSE 0 END) AS readyCount,
        SUM(CASE WHEN designStudioReady IS NULL OR designStudioReady = 0 THEN 1 ELSE 0 END) AS reviewCount,
        MAX(designStudioLastTouchedAt) AS lastTouchedAt
      FROM Product
      WHERE designStudioFamily IS NOT NULL AND TRIM(designStudioFamily) <> ''
      GROUP BY designStudioFamily
      ORDER BY readyCount DESC
      LIMIT 50
    `
    return rows
      .map(row => ({
        family: row.family || 'Unassigned',
        readyCount: toNumber(row.readyCount),
        needsReviewCount: toNumber(row.reviewCount),
        lastTouchedAt: row.lastTouchedAt ? row.lastTouchedAt.toISOString() : null,
      }))
      .filter(row => row.readyCount > 0 || row.needsReviewCount > 0)
  } catch {
    return []
  }
}
