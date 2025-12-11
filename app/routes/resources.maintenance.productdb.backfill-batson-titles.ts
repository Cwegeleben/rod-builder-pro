import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { prisma } from '../db.server'
import type {
  BatsonBlankSeriesContext,
  BatsonBlankRow,
  BatsonReelSeatCategoryContext,
  BatsonReelSeatRow,
} from '../server/importer/products/batsonTitle'

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

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  const dry = url.searchParams.get('dry') === '0' ? false : true
  const suppliersParam = url.searchParams.get('suppliers') // comma separated slugs
  if (token !== 'smoke-ok') {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const defaultSlugs = ['batson-rod-blanks', 'batson-reel-seats']
  const slugs = suppliersParam
    ? suppliersParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : defaultSlugs
  const suppliers = await prisma.supplier.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })
  const supplierIds = suppliers.map(s => s.id)
  if (!supplierIds.length) return json({ ok: true, updated: 0, scanned: 0, suppliers: slugs })

  const products = await prisma.product.findMany({
    where: { supplierId: { in: supplierIds }, type: { in: ['Rod Blank', 'Reel Seat'] } },
    include: { latestVersion: { select: { normSpecs: true } }, supplier: { select: { slug: true } } },
  })

  // Duplicate guard (should be prevented by unique constraint)
  const dupes: Record<string, number> = {}
  products.forEach(p => {
    const k = `${p.supplierId}::${p.productCode}`
    dupes[k] = (dupes[k] || 0) + 1
  })
  const duplicates = Object.entries(dupes)
    .filter(([, n]) => n > 1)
    .map(([k, n]) => ({ key: k, count: n }))

  let updated = 0
  const sample: Array<{ id: string; productCode: string; before: string; after: string }> = []

  const { buildBatsonBlankTitle, buildBatsonReelSeatTitle } = await import('../server/importer/products/batsonTitle')

  for (const p of products) {
    const spec = ((p.latestVersion?.normSpecs as unknown) || {}) as Record<string, unknown>
    const sv = <T>(k: string): T | undefined => (spec[k] as T) ?? undefined
    let nextTitle = p.title

    // Heuristic override: if classified as Rod Blank but has seat cues, treat as Reel Seat
    const hasSizeNoLength = !!sv<string>('size_label') && !sv<number>('length_in')
    const looksLikeSeat = hasSizeNoLength || /reel\s*seat/i.test(String(p.title || ''))
    const effType = p.type === 'Rod Blank' && looksLikeSeat ? 'Reel Seat' : p.type

    if (effType === 'Rod Blank') {
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
      nextTitle = buildBatsonBlankTitle(seriesCtx, row)
    } else if (effType === 'Reel Seat') {
      const brandText = sv<string>('brand') || p.title || ''
      const skuUpper = (p.productCode || '').toUpperCase()
      const brandFallback =
        /alps/i.test(brandText) ||
        /^AIP/i.test(p.productCode) ||
        /\bALPS\b/.test(skuUpper) ||
        /^ALPS[-_]/.test(skuUpper)
          ? 'Alps'
          : /forecast/i.test(brandText) || /\bFORECAST\b/.test(skuUpper) || /^FORECAST[-_]/.test(skuUpper)
            ? 'Forecast'
            : undefined
      const material = normalizeMaterial(sv<string>('material'))
      const categoryType: BatsonReelSeatCategoryContext['categoryType'] = /aluminum/i.test(material || '')
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
      nextTitle = buildBatsonReelSeatTitle({ brandFallback, categoryType }, row)
    } else {
      continue
    }

    nextTitle = stripSkuFromTitle(nextTitle, p.productCode)
    if (!nextTitle || nextTitle === p.title) continue

    if (!dry) {
      await prisma.product.update({ where: { id: p.id }, data: { title: nextTitle } })
    }
    updated++
    if (sample.length < 10) sample.push({ id: p.id, productCode: p.productCode, before: p.title, after: nextTitle })
  }

  return json({ ok: true, dryRun: dry, suppliers: slugs, scanned: products.length, updated, duplicates, sample })
}

export default function BackfillBatsonTitles() {
  return null
}
