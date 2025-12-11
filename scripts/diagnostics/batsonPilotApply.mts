#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import { applyBatsonProducts } from '../../app/services/suppliers/batsonApply.server'
import type { BatsonNormalizedRecord } from '../../app/domain/catalog/batsonNormalizedTypes'

const prisma = new PrismaClient()
const BATCH_LIMIT = Number(process.env.BATSON_PILOT_LIMIT || '3')
const SUPPLIER_SLUGS = [
  'batson-rod-blanks',
  'batson-guides-tops',
  'batson-grips',
  'batson-reel-seats',
  'batson-trim-pieces',
  'batson-end-caps-gimbals',
]

type PilotRow = {
  supplierId: string
  supplierSiteId: string
  title: string
  description?: string | null
  normSpecs: unknown
}

function isNormalizedRecord(value: unknown): value is BatsonNormalizedRecord {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.productCode === 'string' &&
    typeof payload.family === 'string' &&
    typeof payload.brand === 'string'
  )
}

async function ensureSupplier(slug: string) {
  return prisma.supplier.upsert({
    where: { slug },
    update: {},
    create: { slug, name: slug, urlRoot: null },
  })
}

async function fetchPilotRows(slug: string): Promise<PilotRow[]> {
  const rows = await prisma.partStaging.findMany({
    where: { supplierId: slug },
    orderBy: { fetchedAt: 'desc' },
    take: BATCH_LIMIT,
    select: {
      supplierId: true,
      externalId: true,
      title: true,
      description: true,
      normSpecs: true,
    },
  })
  return rows.map(r => ({
    supplierId: slug,
    supplierSiteId: slug,
    title: r.title,
    description: r.description,
    normSpecs: r.normSpecs,
  }))
}

async function run() {
  const applyInputs: Parameters<typeof applyBatsonProducts>[0] = []
  for (const slug of SUPPLIER_SLUGS) {
    const supplier = await ensureSupplier(slug)
    const rows = await fetchPilotRows(slug)
    for (const row of rows) {
      if (!isNormalizedRecord(row.normSpecs)) continue
      applyInputs.push({
        supplierId: supplier.id,
        supplierSiteId: row.supplierSiteId,
        title: row.title,
        description: row.description ?? undefined,
        normalized: row.normSpecs,
      })
    }
  }

  if (!applyInputs.length) {
    console.log('[batsonPilotApply] No normalized rows available for pilot load.')
    return
  }

  const result = await applyBatsonProducts(applyInputs, { mirror: false })
  console.log('[batsonPilotApply] upserts=%d deactivated=%d rows=%d', result.upserts, result.deactivated, applyInputs.length)
}

run()
  .catch(err => {
    console.error('[batsonPilotApply] failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
