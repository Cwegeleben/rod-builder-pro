import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { smokesEnabled, extractSmokeToken } from '../lib/smokes.server'
import { prisma } from '../db.server'

// GET /api/importer/parity.productdb?supplierId=batson&templateId=...
export async function loader({ request }: LoaderFunctionArgs) {
  // Allow smoke-token access when enabled; otherwise require Shopify admin
  let bypassAdmin = false
  try {
    if (smokesEnabled()) {
      const tok = extractSmokeToken(request)
      const expected = process.env.SMOKE_TOKEN || 'smoke-ok'
      bypassAdmin = !!tok && tok === expected
    }
  } catch {
    bypassAdmin = false
  }
  if (!bypassAdmin) await authenticate.admin(request)
  const url = new URL(request.url)
  const supplierId = url.searchParams.get('supplierId') || ''
  const templateId = url.searchParams.get('templateId') || ''
  if (!supplierId) return json({ ok: false, error: 'missing supplierId' }, { status: 400 })

  try {
    const stagingWhere = templateId ? 'supplierId = ? AND templateId = ?' : 'supplierId = ?'
    const stagingArgs = templateId ? [supplierId, templateId] : [supplierId]
    const staging = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
      `SELECT COUNT(1) AS c FROM PartStaging WHERE ${stagingWhere}`,
      ...stagingArgs,
    )
    // Canonical product count by supplier slug match (legacy maps supplierId->slug)
    const products = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
      `SELECT COUNT(1) AS c FROM Product p JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
      supplierId,
    )
    // Version count for the same supplier
    const versions = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
      `SELECT COUNT(1) AS c FROM ProductVersion v JOIN Product p ON p.id = v.productId JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
      supplierId,
    )
    const toNum = (v: unknown) => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : Number(v) || 0)
    return json({
      ok: true,
      supplierId,
      stagingCount: toNum(staging?.[0]?.c),
      productCount: toNum(products?.[0]?.c),
      versionCount: toNum(versions?.[0]?.c),
    })
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}
