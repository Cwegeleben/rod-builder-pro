import { prisma } from '../../db.server'

export type DesignStudioComponentStats = {
  role: string
  readyCount: number
  needsReviewCount: number
  topSkus: Array<{
    productId: string
    sku: string
    family: string | null
    ready: boolean
    coverageNotes: string | null
  }>
}

const asNumber = (value: number | bigint | null | undefined): number => {
  if (typeof value === 'bigint') {
    const coerced = Number(value)
    return Number.isFinite(coerced) ? coerced : Number.MAX_SAFE_INTEGER
  }
  return Number(value ?? 0)
}

export async function loadDesignStudioComponentStats(): Promise<DesignStudioComponentStats[]> {
  if (process.env.PRODUCT_DB_ENABLED !== '1') return []

  try {
    const rows = await prisma.$queryRaw<
      Array<{ role: string | null; readyCount: number | bigint; reviewCount: number | bigint }>
    >`
      SELECT
        COALESCE(pv.designStudioRole, 'component') AS role,
        SUM(CASE WHEN p.designStudioReady = 1 THEN 1 ELSE 0 END) AS readyCount,
        SUM(CASE WHEN p.designStudioReady IS NULL OR p.designStudioReady = 0 THEN 1 ELSE 0 END) AS reviewCount
      FROM Product p
      LEFT JOIN ProductVersion pv ON pv.id = p.latestVersionId
      GROUP BY COALESCE(pv.designStudioRole, 'component')
      ORDER BY readyCount DESC
    `

    const topSkuRows = await prisma.$queryRaw<
      Array<{
        role: string | null
        productId: string
        sku: string
        family: string | null
        ready: number | boolean | null
        coverageNotes: string | null
      }>
    >`
      WITH ranked AS (
        SELECT
          COALESCE(pv.designStudioRole, 'component') AS role,
          p.id AS productId,
          p.sku AS sku,
          p.designStudioFamily AS family,
          p.designStudioReady AS ready,
          p.designStudioCoverageNotes AS coverageNotes,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(pv.designStudioRole, 'component')
            ORDER BY p.designStudioReady DESC, p.designStudioLastTouchedAt DESC
          ) AS rn
        FROM Product p
        LEFT JOIN ProductVersion pv ON pv.id = p.latestVersionId
      )
      SELECT role, productId, sku, family, ready, coverageNotes
      FROM ranked
      WHERE rn <= 5
    `

    const topSkuMap = new Map<
      string,
      Array<{
        productId: string
        sku: string
        family: string | null
        ready: boolean
        coverageNotes: string | null
      }>
    >()
    for (const row of topSkuRows) {
      const role = row.role || 'component'
      const list = topSkuMap.get(role) || []
      if (list.length < 5) {
        list.push({
          productId: row.productId,
          sku: row.sku,
          family: row.family,
          ready: typeof row.ready === 'boolean' ? row.ready : row.ready === 1,
          coverageNotes: row.coverageNotes,
        })
        topSkuMap.set(role, list)
      }
    }

    return rows.map(row => {
      const role = row.role || 'component'
      return {
        role,
        readyCount: asNumber(row.readyCount),
        needsReviewCount: asNumber(row.reviewCount),
        topSkus: topSkuMap.get(role) || [],
      }
    })
  } catch {
    return []
  }
}
