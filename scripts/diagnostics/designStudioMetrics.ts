import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
  console.log('[designStudioMetrics] Defaulting DATABASE_URL to', process.env.DATABASE_URL)
}

const prisma = new PrismaClient()

type Baseline = {
  minProducts?: number
  minReadyProducts?: number
  minSupplierTotals?: Record<string, number>
  minRoleTotals?: Record<string, number>
}

const baselinePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'designStudioMetrics.baseline.json')

function loadBaseline(): Baseline | null {
  try {
    const raw = fs.readFileSync(baselinePath, 'utf-8')
    return JSON.parse(raw) as Baseline
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[designStudioMetrics] Unable to load baseline file:', error)
    }
    return null
  }
}

async function main() {
  const baseline = loadBaseline()
  const [totalProducts, totalVersions] = await Promise.all([prisma.product.count(), prisma.productVersion.count()])

  const readyRows = await prisma.$queryRawUnsafe<Array<{ designStudioReady: number | null; count: number }>>(
    `SELECT designStudioReady, COUNT(*) as count FROM Product GROUP BY designStudioReady`,
  )

  const supplierRows = await prisma.$queryRawUnsafe<
    Array<{ supplierId: string; supplierSlug: string | null; count: number }>
  >(`
    SELECT p.supplierId,
           COALESCE(s.slug, p.supplierId) AS supplierSlug,
           COUNT(*) as count
    FROM Product p
    LEFT JOIN Supplier s ON s.id = p.supplierId
    GROUP BY p.supplierId, supplierSlug
    ORDER BY count DESC`)

  const roleRows = await prisma.$queryRawUnsafe<Array<{ designStudioRole: string | null; count: number }>>(
    `SELECT designStudioRole, COUNT(*) as count FROM ProductVersion GROUP BY designStudioRole ORDER BY count DESC`,
  )

  const coverageRows = await prisma.$queryRawUnsafe<Array<{ missingFamily: number; needsReview: number }>>(
    `SELECT
        SUM(CASE WHEN COALESCE(designStudioFamily, '') = '' THEN 1 ELSE 0 END) AS missingFamily,
        SUM(CASE WHEN designStudioReady = 0 THEN 1 ELSE 0 END) AS needsReview
      FROM Product`,
  )

  console.log('Design Studio Metrics\n======================')
  console.log(`Products: ${totalProducts}`)
  console.log(`ProductVersions: ${totalVersions}`)

  console.log('\nReady vs Needs Review:')
  readyRows.forEach(row => {
    const label = row.designStudioReady ? 'ready' : 'needs_review'
    console.log(`  ${label.padEnd(14)} ${row.count}`)
  })

  console.log('\nProducts per Supplier:')
  supplierRows.forEach(row => {
    const label = row.supplierSlug ?? row.supplierId
    console.log(`  ${label.padEnd(36)} ${row.count}`)
  })

  console.log('\nVersions per Role:')
  roleRows.forEach(row => {
    const label = row.designStudioRole ?? 'unknown'
    console.log(`  ${label.padEnd(12)} ${row.count}`)
  })

  const coverage = coverageRows[0]
  if (coverage) {
    console.log('\nCoverage gaps:')
    console.log(`  missing family : ${coverage.missingFamily}`)
    console.log(`  needs review   : ${coverage.needsReview}`)
  }

  const notReadyRows = await prisma.$queryRawUnsafe<
    Array<{
      supplierId: string
      supplierSlug: string | null
      sku: string
      designPartType: string | null
      blockingReasons: string | null
      coverageNotes: string | null
    }>
  >(`
    SELECT p.supplierId,
           COALESCE(s.slug, p.supplierId) AS supplierSlug,
           p.sku,
           p.designPartType,
           p.designStudioBlockingReasons AS blockingReasons,
           p.designStudioCoverageNotes AS coverageNotes
    FROM Product p
    LEFT JOIN Supplier s ON s.id = p.supplierId
    WHERE COALESCE(p.designStudioReady, 0) = 0
    ORDER BY supplierSlug, p.sku`)

  if (notReadyRows.length) {
    console.log('\nNot-ready products:')
    for (const row of notReadyRows) {
      const supplierLabel = row.supplierSlug ?? row.supplierId
      const reasons = parseBlockingReasons(row.blockingReasons)
      const reasonText = reasons.length ? reasons.join('; ') : row.coverageNotes || 'Missing data'
      console.log(`  - ${supplierLabel}/${row.sku} (${row.designPartType ?? 'UNKNOWN'}): ${reasonText}`)
    }
  }

  if (baseline) {
    const warnings: string[] = []
    const readyCount = readyRows.find(row => row.designStudioReady)?.count ?? 0
    if (baseline.minProducts !== undefined && totalProducts < baseline.minProducts) {
      warnings.push(`Products total ${totalProducts} below expected minimum ${baseline.minProducts}`)
    }
    if (baseline.minReadyProducts !== undefined && readyCount < baseline.minReadyProducts) {
      warnings.push(`DS-ready count ${readyCount} below expected minimum ${baseline.minReadyProducts}`)
    }
    if (baseline.minSupplierTotals) {
      const supplierMap = new Map(supplierRows.map(row => [row.supplierSlug ?? row.supplierId, row.count] as const))
      for (const [key, min] of Object.entries(baseline.minSupplierTotals)) {
        const actual = supplierMap.get(key) ?? 0
        if (actual < min) {
          warnings.push(`Supplier ${key} count ${actual} below expected minimum ${min}`)
        }
      }
    }
    if (baseline.minRoleTotals) {
      const roleMap = new Map(roleRows.map(row => [row.designStudioRole ?? 'unknown', row.count] as const))
      for (const [role, min] of Object.entries(baseline.minRoleTotals)) {
        const actual = roleMap.get(role) ?? 0
        if (actual < min) {
          warnings.push(`Role ${role} count ${actual} below expected minimum ${min}`)
        }
      }
    }
    if (warnings.length) {
      console.warn('\n[designStudioMetrics] WARNINGS:')
      warnings.forEach(message => console.warn(`  - ${message}`))
    }
  }

  await prisma.$disconnect()
}

function parseBlockingReasons(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) {
      return parsed
        .map(reason => {
          if (reason && typeof reason === 'object' && 'message' in reason) return String(reason.message)
          if (typeof reason === 'string') return reason
          return null
        })
        .filter((message): message is string => Boolean(message))
    }
  } catch {
    return []
  }
  return []
}

main().catch(error => {
  console.error('[designStudioMetrics] fatal', error)
  prisma
    .$disconnect()
    .catch(() => null)
    .finally(() => {
      process.exit(1)
    })
})
