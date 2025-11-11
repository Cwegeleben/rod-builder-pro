import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { prisma } from '../db.server'

// GET /api/importer/parity.productdb?supplierId=batson&templateId=...
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const url = new URL(request.url)
  const supplierId = url.searchParams.get('supplierId') || ''
  const templateId = url.searchParams.get('templateId') || ''
  if (!supplierId) return json({ ok: false, error: 'missing supplierId' }, { status: 400 })

  try {
    const stagingWhere = templateId ? 'supplierId = ? AND templateId = ?' : 'supplierId = ?'
    const stagingArgs = templateId ? [supplierId, templateId] : [supplierId]
    const staging = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(1) AS c FROM PartStaging WHERE ${stagingWhere}`,
      ...stagingArgs,
    )
    // Canonical product count by supplier slug match (legacy maps supplierId->slug)
    const products = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(1) AS c FROM Product p JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
      supplierId,
    )
    // Version count for the same supplier
    const versions = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(1) AS c FROM ProductVersion v JOIN Product p ON p.id = v.productId JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
      supplierId,
    )
    return json({
      ok: true,
      supplierId,
      stagingCount: staging?.[0]?.c || 0,
      productCount: products?.[0]?.c || 0,
      versionCount: versions?.[0]?.c || 0,
    })
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}
