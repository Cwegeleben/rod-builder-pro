import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'

// GET /resources/smoke/importer/productdb/clear?token=...&confirm=YES
// Purges ProductSource, ProductVersion, Product without backup. Returns remaining counts.
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    guardSmokeRoute({ request } as LoaderFunctionArgs)
  } catch (e) {
    if (e instanceof Response) return e
    return json({ ok: false, error: 'Unauthorized' }, { status: 403 })
  }
  const url = new URL(request.url)
  const confirm = url.searchParams.get('confirm')
  if (confirm !== 'YES') return json({ ok: false, error: 'Missing confirm=YES' }, { status: 400 })

  let productsDeleted = 0
  let sourcesDeleted = 0
  let versionsDeleted = 0
  try {
    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table'`,
    )
    const has = (n: string) => tables.some(t => t.name === n)
    if (has('ProductSource')) {
      const r = await prisma.productSource.deleteMany({})
      sourcesDeleted = r.count
    }
    // Explicitly delete versions first; schema should cascade, but be defensive
    if (has('ProductVersion')) {
      const r = await prisma.productVersion.deleteMany({})
      versionsDeleted = r.count
    }
    if (has('Product')) {
      const r = await prisma.product.deleteMany({})
      productsDeleted = r.count
    }
  } catch (e) {
    return json({ ok: false, error: (e as Error).message || 'Purge failed' }, { status: 500 })
  }

  const [pLeft, vLeft, sLeft] = await Promise.all([
    prisma.product.count().catch(() => 0),
    prisma.productVersion.count().catch(() => 0),
    prisma.productSource.count().catch(() => 0),
  ])

  return json({
    ok: true,
    deleted: { products: productsDeleted, versions: versionsDeleted, sources: sourcesDeleted },
    remaining: { products: pLeft, versions: vLeft, sources: sLeft },
  })
}

export default function SmokeImporterProductDbClear() {
  return null
}
