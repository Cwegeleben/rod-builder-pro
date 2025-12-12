import { Prisma, ProductStatus } from '@prisma/client'
import { resolve } from 'node:path'
import { prisma } from '../../app/db.server'
import type { ProductDiff } from '../../app/domain/imports/diffTypes'
import { saveImportRunDiff } from '../../app/services/imports/persistDiff.server'
import { applyImportRun } from '../../app/services/imports/applyRun.server'
let supplierIdValue: string
import { getProductImportRunDetail, listProductImportRuns } from '../../app/models/productImportRun.server'

const SUPPLIER_SLUG = process.env.SUPPLIER_SLUG || 'batson-smoke'
const SUPPLIER_SITE = 'batson-test-site'
const PRODUCT_CODES = {
  add: 'SMOKE-ADD-001',
  change: 'SMOKE-CHG-002',
  delete: 'SMOKE-DEL-003',
}

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${resolve(process.cwd(), 'prisma/dev.sqlite')}`
    console.log(`[env] DATABASE_URL not set; using ${process.env.DATABASE_URL}`)
  }
  await ensureSupplier()
  await resetExistingData()
  await seedPartStaging()
  await seedCanonicalProducts()

  const diffs = buildDiffPayload()
  const { run } = await saveImportRunDiff({
    supplierSlug: SUPPLIER_SLUG,
    supplierId: supplierIdValue,
    diffs,
    status: 'diffed',
    startedAt: new Date(Date.now() - 5 * 60_000),
    finishedAt: new Date(),
    summary: { source: 'ui-smoke-script' },
  })

  console.log('\nCreated run:', run.id)
  await logListSnapshot()
  await logDetailSnapshot(run.id)

  const applyResult = await applyImportRun(run.id)
  console.log('\nApply result:', applyResult)

  const refreshedRun = await prisma.productImportRun.findUnique({ where: { id: run.id } })
  console.log('Run status after apply:', refreshedRun?.status)
  console.log('Run summary.apply counts:', refreshedRun?.summary)

  await logProductStates()
}

async function ensureSupplier() {
  const supplier = await prisma.supplier.upsert({
    where: { slug: SUPPLIER_SLUG },
    update: { name: 'Batson Smoke QA', urlRoot: 'https://batson.enterprises/smoke' },
    create: {
      slug: SUPPLIER_SLUG,
      name: 'Batson Smoke QA',
      urlRoot: 'https://batson.enterprises/smoke',
    },
  })
  supplierIdValue = supplier.id
}

async function resetExistingData() {
  await prisma.productImportRunItem.deleteMany({ where: { productCode: { in: Object.values(PRODUCT_CODES) } } })
  await prisma.productImportRun.deleteMany({ where: { supplierSlug: SUPPLIER_SLUG } })
  await prisma.partStaging.deleteMany({
    where: { supplierId: supplierIdValue, externalId: { in: Object.values(PRODUCT_CODES) } },
  })
}

async function seedPartStaging() {
  const baseNormalized = {
    brand: 'Batson',
    series: 'Smoke Test',
    family: 'singleFootGuide',
    material: 'Stainless Steel',
    availability: 'inStock',
    color: 'Gunmetal',
    frameMaterial: 'SS316',
    frameFinish: 'Gunmetal',
    ringMaterial: 'Zirconia',
    ringSize: 8,
    footType: 'single',
    height_mm: 24,
    weightOz: 0.13,
    tubeSize: 6,
    frameMaterialCode: 'SS',
    ringMaterialCode: 'ZR',
    footLength_mm: 12,
    frameProfile: 'low',
    usageHints: 'General purpose',
  }

  const rows = [
    {
      productCode: PRODUCT_CODES.add,
      title: 'Smoke QA Guide Add',
      msrp: 14.5,
    },
    {
      productCode: PRODUCT_CODES.change,
      title: 'Smoke QA Guide Change',
      msrp: 18.75,
    },
  ]

  for (const row of rows) {
    await prisma.partStaging.create({
      data: {
        supplierId: supplierIdValue,
        externalId: row.productCode,
        title: row.title,
        partType: 'guide',
        description: `${row.title} description`,
        images: [`https://example.com/${row.productCode}.jpg`],
        normSpecs: {
          ...baseNormalized,
          productCode: row.productCode,
          msrp: row.msrp,
        },
        designStudioReady: true,
        designStudioFamily: 'Smoke QA',
      },
    })
  }
}

async function seedCanonicalProducts() {
  const baseProduct = {
    supplierId: supplierIdValue,
    supplierSiteId: SUPPLIER_SITE,
    category: 'guide',
    type: 'guide',
    family: 'Smoke QA',
    brand: 'Batson',
    series: 'Smoke Test',
    material: 'Stainless Steel',
    color: 'Gunmetal',
    designPartType: 'GUIDE',
    status: ProductStatus.READY,
    title: 'Smoke QA Existing',
    description: 'Existing catalog entry',
    images: ['https://example.com/existing.jpg'],
    msrp: new Prisma.Decimal(17.25),
    availability: 'IN_STOCK',
    attributes: { frameFinish: 'Gunmetal', ringSize: 8 },
    active: true,
  }

  await prisma.product.upsert({
    where: {
      product_supplier_product_code_unique: {
        supplierId: supplierIdValue,
        productCode: PRODUCT_CODES.change,
      },
    },
    create: {
      ...baseProduct,
      productCode: PRODUCT_CODES.change,
    },
    update: baseProduct,
  })

  await prisma.product.upsert({
    where: {
      product_supplier_product_code_unique: {
        supplierId: supplierIdValue,
        productCode: PRODUCT_CODES.delete,
      },
    },
    create: {
      ...baseProduct,
      productCode: PRODUCT_CODES.delete,
      title: 'Smoke QA Delete Target',
      msrp: new Prisma.Decimal(11.5),
    },
    update: baseProduct,
  })
}

function buildDiffPayload(): ProductDiff[] {
  const baseSnapshot = {
    brand: 'Batson',
    series: 'Smoke Test',
    material: 'Stainless Steel',
    color: 'Gunmetal',
    category: 'guide',
    attributes: {
      frameMaterial: 'SS316',
      ringMaterial: 'Zirconia',
      ringSize: 8,
    },
  }

  return [
    {
      supplier: SUPPLIER_SLUG,
      supplierSiteId: SUPPLIER_SITE,
      productCode: PRODUCT_CODES.add,
      category: 'guide',
      family: 'Smoke QA',
      kind: 'add',
      after: {
        ...baseSnapshot,
        msrp: 14.5,
        availability: 'IN_STOCK',
        designStudioReady: true,
      },
    },
    {
      supplier: SUPPLIER_SLUG,
      supplierSiteId: SUPPLIER_SITE,
      productCode: PRODUCT_CODES.change,
      category: 'guide',
      family: 'Smoke QA',
      kind: 'change',
      before: {
        ...baseSnapshot,
        msrp: 17.25,
        availability: 'LOW_STOCK',
        designStudioReady: true,
      },
      after: {
        ...baseSnapshot,
        msrp: 18.75,
        availability: 'IN_STOCK',
        designStudioReady: true,
      },
      changedFields: [
        { field: 'msrp', before: 17.25, after: 18.75 },
        { field: 'availability', before: 'LOW_STOCK', after: 'IN_STOCK' },
      ],
    },
    {
      supplier: SUPPLIER_SLUG,
      supplierSiteId: SUPPLIER_SITE,
      productCode: PRODUCT_CODES.delete,
      category: 'guide',
      family: 'Smoke QA',
      kind: 'delete',
      before: {
        ...baseSnapshot,
        msrp: 11.5,
        availability: 'IN_STOCK',
        designStudioReady: true,
      },
    },
  ]
}

async function logListSnapshot() {
  const runs = await listProductImportRuns({ supplierSlug: SUPPLIER_SLUG, limit: 5 })
  console.log('\nList snapshot:')
  for (const run of runs) {
    console.log({
      id: run.id,
      status: run.status,
      adds: run.totalAdds,
      changes: run.totalChanges,
      deletes: run.totalDeletes,
    })
  }
}

async function logDetailSnapshot(runId: string) {
  const detail = await getProductImportRunDetail(runId)
  if (!detail) {
    console.warn('Missing detail for run', runId)
    return
  }
  console.log('\nDetail snapshot totals:', {
    adds: detail.itemsByKind.add.length,
    changes: detail.itemsByKind.change.length,
    deletes: detail.itemsByKind.delete.length,
  })
  const changeItem = detail.itemsByKind.change[0]
  if (changeItem) {
    console.log('Sample change diff:', changeItem.productCode, changeItem.changedFields)
  }
}

async function logProductStates() {
  const rows = await prisma.product.findMany({
    where: { supplierId: supplierIdValue, productCode: { in: Object.values(PRODUCT_CODES) } },
    select: {
      productCode: true,
      title: true,
      msrp: true,
      availability: true,
      active: true,
      updatedAt: true,
    },
    orderBy: { productCode: 'asc' },
  })
  console.log('\nProduct states:')
  for (const row of rows) {
    console.log({
      code: row.productCode,
      msrp: row.msrp?.toString(),
      availability: row.availability,
      active: row.active,
      updatedAt: row.updatedAt.toISOString(),
    })
  }
}

main()
  .catch(error => {
    console.error('Smoke script failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
