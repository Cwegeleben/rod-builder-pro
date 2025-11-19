import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'

// GET /resources/smoke/importer/productdb/cleanup-misclassified?token=...&supplier=batson-rod-blanks&skuLike=DALT%&confirm=YES
// - Requires ENABLE_SMOKES and valid token
// - When confirm!=YES, performs a dry-run and returns counts only
// - Supports skuLike (SQL LIKE pattern) or repeated sku params (exact match list)
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    guardSmokeRoute({ request } as LoaderFunctionArgs)
  } catch (e) {
    if (e instanceof Response) return e
    return json({ ok: false, error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(request.url)
  const supplierSlug = (url.searchParams.get('supplier') || '').trim()
  const confirm = url.searchParams.get('confirm') || ''
  const dryRun = confirm !== 'YES'
  const skuLike = url.searchParams.get('skuLike') || ''
  const skuParams = url.searchParams.getAll('sku')
  const skus = skuParams.map(s => String(s || '').trim()).filter(Boolean)

  if (!supplierSlug) return json({ ok: false, error: 'Missing supplier' }, { status: 400 })
  if (!skuLike && skus.length === 0) {
    return json({ ok: false, error: 'Provide skuLike or one or more sku params' }, { status: 400 })
  }

  // Resolve supplierId
  const supRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    'SELECT id FROM Supplier WHERE slug = ? LIMIT 1',
    supplierSlug,
  )
  if (!supRows || !supRows.length)
    return json({ ok: false, error: 'Supplier not found', supplier: supplierSlug }, { status: 404 })
  const supplierId = supRows[0].id

  // Collect candidate product ids
  let prodRows: Array<{ id: string; sku: string }> = []
  if (skus.length) {
    const placeholders = skus.map(() => '?').join(',')
    prodRows = await prisma.$queryRawUnsafe<Array<{ id: string; sku: string }>>(
      `SELECT id, sku FROM Product WHERE supplierId = ? AND sku IN (${placeholders})`,
      supplierId,
      ...skus,
    )
  } else if (skuLike) {
    prodRows = await prisma.$queryRawUnsafe<Array<{ id: string; sku: string }>>(
      'SELECT id, sku FROM Product WHERE supplierId = ? AND sku LIKE ?',
      supplierId,
      skuLike,
    )
  }

  const productIds = prodRows.map(r => r.id)
  const affectedSkus = prodRows.map(r => r.sku)
  if (productIds.length === 0)
    return json({ ok: true, supplier: supplierSlug, matches: 0, deleted: { products: 0, versions: 0 } })

  // Count versions
  const placeholders = productIds.map(() => '?').join(',')
  const verCountRows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(1) as c FROM ProductVersion WHERE productId IN (${placeholders})`,
    ...productIds,
  )
  const versionCount = verCountRows?.[0]?.c || 0

  if (dryRun) {
    return json({
      ok: true,
      supplier: supplierSlug,
      matches: productIds.length,
      versions: versionCount,
      skus: affectedSkus,
    })
  }

  // Attempt to null out ProductSource.productId for these products if the column exists
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE ProductSource SET productId = NULL WHERE productId IN (${placeholders})`,
      ...productIds,
    )
  } catch {
    // ignore if column does not exist
  }

  // Delete versions then products
  const delVer = await prisma.$executeRawUnsafe(
    `DELETE FROM ProductVersion WHERE productId IN (${placeholders})`,
    ...productIds,
  )
  await prisma.$executeRawUnsafe(`DELETE FROM Product WHERE id IN (${placeholders})`, ...productIds)

  return json({
    ok: true,
    supplier: supplierSlug,
    deleted: { products: productIds.length, versions: Number(delVer) || versionCount },
    skus: affectedSkus,
  })
}

export default function SmokeImporterProductDbCleanupMisclassified() {
  return null
}
