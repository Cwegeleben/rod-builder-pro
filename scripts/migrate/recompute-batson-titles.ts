/*
  Recompute normalized titles for existing Batson products in product_db.
  - Never include SKU/model code in titles
  - Idempotent: only update when changed
  - Logs duplicate SKUs if encountered (should not happen due to DB constraint)
*/
import { prisma } from '../../app/db.server'
import type {
  BatsonBlankSeriesContext,
  BatsonBlankRow,
  BatsonReelSeatCategoryContext,
  BatsonReelSeatRow,
} from '../../app/server/importer/products/batsonTitle'

function stripSkuFromTitle(title: string, sku: string): string {
  let t = title
  const parts = [sku, sku.split('-')[0]]
  for (const p of parts) {
    if (!p) continue
    const re = new RegExp(`(?:^|\b)${p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\b|$)`, 'ig')
    t = t
      .replace(re, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+–\s*$/g, '')
      .trim()
  }
  return t
}

function isLikelyCode(token?: string | null): boolean {
  if (!token) return false
  const t = token.trim()
  if (!t) return false
  if (/^[A-Z]{1,}[A-Z0-9]*\d[A-Z0-9]*$/i.test(t)) return true
  if (/^[A-Z]{2,}\d$/i.test(t)) return true
  return false
}

function normalizeMaterial(m?: string | null): string | undefined {
  if (!m) return undefined
  const cleaned = String(m)
    .replace(/\b6061[-\s]*t6\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || 'Aluminum'
}

function coerceHardwareKind(s?: string | null): BatsonReelSeatRow['hardwareKind'] {
  const v = (s || '').trim()
  const allowed: ReadonlyArray<BatsonReelSeatRow['hardwareKind']> = [
    'Reel Seat Hood',
    'Reel Seat Trim Ring and Bottom Hood',
    'Reel Seat Extension Ring',
    'Reel Seat Locking Nut',
    'Reel Seat Shim',
  ]
  return (allowed as readonly string[]).includes(v) ? (v as BatsonReelSeatRow['hardwareKind']) : undefined
}

async function main() {
  console.log('[recompute-batson-titles] starting')
  const suppliers = await prisma.supplier.findMany({
    where: { slug: { in: ['batson-rod-blanks', 'batson-reel-seats'] } },
    select: { id: true, slug: true, name: true },
  })
  const supplierIds = suppliers.map(s => s.id)
  if (supplierIds.length === 0) {
    console.log('[recompute-batson-titles] no Batson suppliers found; exiting')
    return
  }

  // Load products with latest version specs
  const products = await prisma.product.findMany({
    where: { supplierId: { in: supplierIds }, type: { in: ['Rod Blank', 'Reel Seat'] } },
    include: { latestVersion: { select: { normSpecs: true } }, supplier: { select: { slug: true } } },
  })

  // Duplicate SKU guard (should be impossible due to unique constraint)
  const dupes: Record<string, number> = {}
  for (const p of products) {
    const key = `${p.supplierId}::${p.productCode}`
    dupes[key] = (dupes[key] || 0) + 1
  }
  const dupList = Object.entries(dupes).filter(([, n]) => n > 1)
  if (dupList.length) {
    console.warn('[recompute-batson-titles] duplicate SKUs detected:', dupList)
  }

  // Lazy import builders to avoid heavy module tree if not needed
  // builders will be imported on-demand below

  let updates = 0
  for (const p of products) {
    const spec = ((p.latestVersion?.normSpecs as unknown) || {}) as Record<string, unknown>
    const sv = <T>(k: string): T | undefined => (spec[k] as T) ?? undefined
    let nextTitle = p.title

    if (p.type === 'Rod Blank') {
      const seriesDisplayName: string = sv<string>('series') || ''
      const coreMatch = seriesDisplayName.match(/^(.*?\b(?:RX6|RX7|Revelation RX7)\b)/i)
      const seriesCore = (coreMatch ? coreMatch[1] : seriesDisplayName).trim()
      const techniqueLabel = seriesDisplayName
        .replace(seriesCore, '')
        .trim()
        .replace(/^[-–:\s]+/, '')
      const seriesCtx: BatsonBlankSeriesContext = {
        brandName: 'Rainshadow',
        seriesDisplayName,
        seriesCore,
        techniqueLabel,
      }
      const row: BatsonBlankRow = {
        modelCode: p.productCode,
        lengthFtInRaw: sv<string>('length_label') || String(sv<number>('length_in') || ''),
        piecesRaw: String(sv<number>('pieces') || ''),
        powerRaw: sv<string>('power') || '',
        actionRaw: sv<string>('action') || undefined,
        finishOrColorRaw: sv<string>('color') || undefined,
      }
      const { buildBatsonBlankTitle } = await import('../../app/server/importer/products/batsonTitle')
      nextTitle = buildBatsonBlankTitle(seriesCtx, row)
    } else if (p.type === 'Reel Seat') {
      const brandFallback =
        /alps/i.test(sv<string>('brand') || p.title || '') || /^AIP/i.test(p.productCode)
          ? 'Alps'
          : /forecast/i.test(sv<string>('brand') || p.title || '')
            ? 'Forecast'
            : undefined
      const material = normalizeMaterial(sv<string>('material'))
      const categoryType = /aluminum/i.test(material || '')
        ? 'Aluminum Reel Seat'
        : /graphite/i.test(material || '')
          ? 'Graphite Reel Seat'
          : /fly/i.test(sv<string>('seatStyle') || p.title || '')
            ? 'Fly Reel Seat'
            : 'Reel Seat Hardware'
      const familyName = (() => {
        const t = String(sv<string>('series') || p.title || '')
        if (/aip\s*contour/i.test(t) || (/^AIP/i.test(p.productCode) && /contour/i.test(t))) return 'AIP Contour'
        const f = String(sv<string>('familyName') || '')
        return isLikelyCode(f) ? '' : f || ''
      })()
      const row: BatsonReelSeatRow = {
        rawName: p.title,
        brandRaw: sv<string>('brand') || undefined,
        codeRaw: p.productCode,
        familyName: familyName || undefined,
        seatStyle:
          sv<string>('seatStyle') ||
          (/contour/i.test(String(sv<string>('series') || p.title || '')) ? 'Contour' : undefined),
        size: sv<string>('size_label') || sv<string>('size') || undefined,
        material: material,
        finishColor: sv<string>('color') || undefined,
        isInsertOnly: Boolean(sv<boolean>('isInsertOnly')),
        insertMaterial: sv<string>('insertMaterial') || undefined,
        hardwareKind: coerceHardwareKind(sv<string>('hardwareKind')),
      }
      const cat: BatsonReelSeatCategoryContext = { brandFallback, categoryType }
      const { buildBatsonReelSeatTitle } = await import('../../app/server/importer/products/batsonTitle')
      nextTitle = buildBatsonReelSeatTitle(cat, row)
    } else {
      continue
    }

    nextTitle = stripSkuFromTitle(nextTitle, p.productCode)
    if (!nextTitle || nextTitle === p.title) continue

    await prisma.product.update({ where: { id: p.id }, data: { title: nextTitle } })
    updates++
    if (updates % 25 === 0) console.log(`[recompute-batson-titles] updated ${updates} so far...`)
  }

  console.log(`[recompute-batson-titles] done. updated: ${updates}, scanned: ${products.length}`)
}

main().catch(err => {
  console.error('[recompute-batson-titles] failed', err)
  process.exitCode = 1
})
