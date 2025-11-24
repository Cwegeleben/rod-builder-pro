import { prisma } from '../../app/db.server'

async function main() {
  const siteId = (process.env.SITE_ID || '').trim()
  const sample = Math.max(1, Math.min(25, Number(process.env.SAMPLE || '10') || 10))
  if (!siteId) {
    console.error('[checkSeedSample] SITE_ID required')
    process.exit(1)
    return
  }

  let supplierId = siteId
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM Supplier WHERE slug = ? LIMIT 1',
      siteId,
    )
    if (rows && rows.length) supplierId = rows[0].id
  } catch {
    /* ignore */
  }

  const supplierIds = Array.from(new Set([siteId, supplierId])).filter(Boolean)
  const placeholders = supplierIds.map(() => '?').join(',')
  const countSql = `SELECT COUNT(*) as count FROM ProductSource WHERE supplierId IN (${placeholders})`
  const rows = await prisma.$queryRawUnsafe<Array<{ count: number | bigint }>>(countSql, ...supplierIds)
  const total = Number(rows?.[0]?.count || 0)

  const sampleSql = `SELECT url, lastSeenAt FROM ProductSource WHERE supplierId IN (${placeholders}) ORDER BY lastSeenAt DESC LIMIT ?`
  const sampleRows = await prisma.$queryRawUnsafe<Array<{ url: string; lastSeenAt: string | Date }>>(
    sampleSql,
    ...supplierIds,
    sample,
  )
  const normalizedSample = sampleRows.map(r => ({
    url: r.url,
    lastSeenAt: r.lastSeenAt instanceof Date ? r.lastSeenAt.toISOString() : r.lastSeenAt,
  }))

  console.log(
    JSON.stringify(
      {
        ok: true,
        siteId,
        supplierIds,
        total,
        sample: normalizedSample,
      },
      null,
      2,
    ),
  )
}

main()
  .catch(err => {
    console.error('[checkSeedSample] fatal', err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
    } catch {
      /* ignore */
    }
  })
