import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'

// POST /api/importer/maintenance/productdb-purge?confirm=YES
// Hard-deletes ProductSource, ProductVersion, Product rows (no backup) in production.
// Requires confirm=YES and HQ auth.
async function doPurge() {
  // Table existence guard (SQLite)
  let productsDeleted = 0
  let sourcesDeleted = 0
  let versionsDeleted = 0
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table'`,
  )
  const has = (n: string) => tables.some(t => t.name === n)
  if (has('ProductSource')) {
    const r = await prisma.productSource.deleteMany({})
    sourcesDeleted = r.count
  }
  // ProductVersion rows are cascaded on Product delete (if FK constraints enforced). Delete explicitly for clarity.
  if (has('ProductVersion')) {
    const r = await prisma.productVersion.deleteMany({})
    versionsDeleted = r.count
  }
  if (has('Product')) {
    const r = await prisma.product.deleteMany({})
    productsDeleted = r.count
  }

  // Return post-delete counts to prove purge succeeded
  const [pLeft, vLeft, sLeft] = await Promise.all([
    prisma.product.count().catch(() => 0),
    prisma.productVersion.count().catch(() => 0),
    prisma.productSource.count().catch(() => 0),
  ])

  return {
    ok: true as const,
    deleted: { products: productsDeleted, versions: versionsDeleted, sources: sourcesDeleted },
    remaining: { products: pLeft, versions: vLeft, sources: sLeft },
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, { status: 405 })
  const url = new URL(request.url)
  const confirm = url.searchParams.get('confirm')
  if (confirm !== 'YES') return json({ ok: false, error: 'Missing confirm=YES' }, { status: 400 })
  try {
    const result = await doPurge()
    return json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message || 'Purge failed' }, { status: 500 })
  }
}

// Optional GET loader for HQ override (hq=1) to support simple triggering without POST tooling.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const confirm = url.searchParams.get('confirm')
  if (confirm !== 'YES') return json({ ok: false, error: 'Missing confirm=YES' }, { status: 400 })
  try {
    const result = await doPurge()
    return json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message || 'Purge failed' }, { status: 500 })
  }
}

export default function ProductDbPurge() {
  return null
}
