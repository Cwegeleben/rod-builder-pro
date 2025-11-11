import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'
import { upsertNormalizedProduct } from '../services/productDbWriter.server'
import type { Prisma } from '@prisma/client'

export async function loader({ request }: LoaderFunctionArgs) {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const supplierId = url.searchParams.get('supplierId') || 'batson-rod-blanks'
  const templateId = url.searchParams.get('templateId') || undefined

  const where = templateId ? { supplierId, templateId } : { supplierId }
  const staging = await prisma.partStaging.findMany({ where })
  let touched = 0
  for (const r of staging) {
    try {
      await upsertNormalizedProduct({
        supplier: { id: supplierId },
        sku: r.externalId,
        title: r.title,
        type: r.partType || null,
        description: (r.description as string | null) || null,
        images: (r.images as unknown as Prisma.InputJsonValue) || null,
        rawSpecs: (r.rawSpecs as unknown as Prisma.InputJsonValue) || null,
        normSpecs: (r.normSpecs as unknown as Prisma.InputJsonValue) || null,
        priceMsrp: r.priceMsrp != null ? Number(r.priceMsrp as unknown as number | string) : null,
        priceWholesale: r.priceWh != null ? Number(r.priceWh as unknown as number | string) : null,
        availability: (r as { availability?: string }).availability || null,
        sources: null,
        fetchedAt: r.fetchedAt || new Date(),
      })
      touched++
    } catch {
      // ignore and continue
    }
  }
  // Count products/versions after
  let productCount = 0
  let versionCount = 0
  try {
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
  } catch {
    /* ignore */
  }

  return json({ ok: true, supplierId, stagingCount: staging.length, touched, productCount, versionCount })
}

// No default export to keep this a pure resource route
