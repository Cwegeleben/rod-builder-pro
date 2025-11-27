import { prisma } from '../../db.server'

export type DesignStudioRoleBreakdown = {
  role: string
  count: number
}

export type DesignStudioFamilyBreakdown = {
  family: string
  count: number
}

export type DesignStudioMetrics = {
  readyCount: number
  needsReviewCount: number
  roleBreakdown: DesignStudioRoleBreakdown[]
  familyBreakdown: DesignStudioFamilyBreakdown[]
  lastAuditAt: string | null
  canonicalEnabled: boolean
}

const asNumber = (value: number | bigint | null | undefined): number => {
  if (typeof value === 'bigint') {
    const coerced = Number(value)
    return Number.isFinite(coerced) ? coerced : Number.MAX_SAFE_INTEGER
  }
  return Number(value ?? 0)
}

async function queryRoleBreakdown(): Promise<DesignStudioRoleBreakdown[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ role: string | null; count: number | bigint }>>`
      SELECT pv.designStudioRole AS role, COUNT(1) AS count
      FROM Product p
      LEFT JOIN ProductVersion pv ON pv.id = p.latestVersionId
      WHERE p.designStudioReady = 1
      GROUP BY pv.designStudioRole
      ORDER BY count DESC
      LIMIT 6
    `
    return rows.map(row => ({ role: row.role || 'unknown', count: asNumber(row.count) })).filter(item => item.count > 0)
  } catch {
    return []
  }
}

async function queryFamilyBreakdown(): Promise<DesignStudioFamilyBreakdown[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ family: string | null; count: number | bigint }>>`
      SELECT p.designStudioFamily AS family, COUNT(1) AS count
      FROM Product p
      WHERE p.designStudioReady = 1 AND COALESCE(p.designStudioFamily, '') <> ''
      GROUP BY p.designStudioFamily
      ORDER BY count DESC
      LIMIT 6
    `
    return rows
      .map(row => ({ family: row.family || 'Unassigned', count: asNumber(row.count) }))
      .filter(item => item.count > 0)
  } catch {
    return []
  }
}

export async function loadDesignStudioMetrics(): Promise<DesignStudioMetrics> {
  const canonicalEnabled = process.env.PRODUCT_DB_ENABLED === '1'
  if (!canonicalEnabled) {
    return {
      readyCount: 0,
      needsReviewCount: 0,
      roleBreakdown: [],
      familyBreakdown: [],
      lastAuditAt: null,
      canonicalEnabled,
    }
  }

  const readyPromise = prisma.product.count({ where: { designStudioReady: true } }).catch(() => 0)
  const needsReviewPromise = prisma.product.count({ where: { designStudioReady: false } }).catch(() => 0)
  const rolePromise = queryRoleBreakdown()
  const familyPromise = queryFamilyBreakdown()
  const lastAuditPromise = prisma.designStudioAnnotationAudit
    .findFirst({ select: { recordedAt: true }, orderBy: { recordedAt: 'desc' } })
    .catch(() => null)

  const [readyCount, needsReviewCount, roleBreakdown, familyBreakdown, lastAudit] = await Promise.all([
    readyPromise,
    needsReviewPromise,
    rolePromise,
    familyPromise,
    lastAuditPromise,
  ])

  return {
    readyCount,
    needsReviewCount,
    roleBreakdown,
    familyBreakdown,
    lastAuditAt: lastAudit?.recordedAt ? lastAudit.recordedAt.toISOString() : null,
    canonicalEnabled,
  }
}
