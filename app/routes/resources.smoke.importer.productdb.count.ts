import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'

// GET /resources/smoke/importer/productdb.count?supplierId=batson-rod-blanks
// Returns: { ok, supplierId, productCount, versionCount }
export async function loader({ request }: LoaderFunctionArgs) {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const supplierId = url.searchParams.get('supplierId') || 'batson-rod-blanks'

  let productCount = 0
  let versionCount = 0
  try {
    const productTable = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Product'",
    )
    if (productTable.length) {
      const products = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
        `SELECT COUNT(1) AS c FROM Product p JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
        supplierId,
      )
      const versions = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
        `SELECT COUNT(1) AS c FROM ProductVersion v JOIN Product p ON p.id = v.productId JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
        supplierId,
      )
      const toNum = (v: unknown) => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : Number(v) || 0)
      productCount = toNum(products?.[0]?.c)
      versionCount = toNum(versions?.[0]?.c)
    }
  } catch (e) {
    return json({ ok: false, supplierId, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
  return json({ ok: true, supplierId, productCount, versionCount })
}

// No default export to keep resource JSON-only
