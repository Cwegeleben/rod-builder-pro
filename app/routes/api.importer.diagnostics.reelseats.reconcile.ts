import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import * as cheerio from 'cheerio'
import crypto from 'node:crypto'

// HQ-only diagnostic: reconciles Batson reel seat sources vs products and attempts normalization reasons for unlinked sources.
// GET /api/importer/diagnostics/reelseats/reconcile?limit=50
export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const limitParam = (() => {
    const raw = url.searchParams.get('limit')
    if (!raw) return 50
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50
  })()
  const supplierSlug = 'batson-reel-seats'
  let supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
  if (!supplier) {
    // Best-effort auto-create supplier if missing so diagnostics can run early in new envs
    try {
      const id = crypto.randomUUID()
      await prisma.$executeRawUnsafe(
        'INSERT INTO Supplier (id, slug, name, active, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        id,
        supplierSlug,
        'Batson Reel Seats',
      )
      supplier = { id, slug: supplierSlug, name: 'Batson Reel Seats' } as unknown as typeof supplier
    } catch {
      return json({ error: 'supplier-missing', supplierSlug }, { status: 404 })
    }
  }
  if (!supplier) return json({ error: 'supplier-missing', supplierSlug }, { status: 404 })
  const supplierId = supplier.id
  const sources = await prisma.productSource.findMany({ where: { supplierId } })
  const products = await prisma.product.findMany({ where: { supplierId } })
  const byId = new Map(products.map(p => [p.id, p]))
  const totalSources = sources.length
  const linkedSources = sources.filter(s => !!s.productId).length
  const unlinked = sources.filter(s => !s.productId)

  // Group linked sources by SKU
  const skuGrouping: Record<string, { countSources: number; productId: string; title: string }> = {}
  for (const s of sources) {
    if (!s.productId) continue
    const p = byId.get(s.productId)
    if (!p) continue
    const sku = (p as { sku?: string }).sku || 'unknown'
    const title = (p as { title?: string }).title || 'Untitled'
    const pid = (p as { id?: string }).id || 'unknown'
    if (!skuGrouping[sku]) skuGrouping[sku] = { countSources: 0, productId: pid, title }
    skuGrouping[sku].countSources++
  }

  // Analyze a sample of unlinked source URLs: fetch HTML and attempt lightweight reel-seat normalization heuristics
  const sampleSize = Math.min(limitParam, unlinked.length)
  const sample = unlinked.slice(0, sampleSize)
  type SkipDiag = { url: string; reason: string; h1?: string; tokens?: string[] }
  const diagnostics: SkipDiag[] = []

  const fetchHtml = async (u: string): Promise<string | null> => {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    try {
      const r = await fetch(u, { headers, signal: ctrl.signal })
      if (!r.ok) return null
      const t = await r.text()
      return t
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  const FAMILY_HINTS = ['dual trigger', 'aip contour', 'vtg', 'tx17', 'rapid spin']
  const SIZE_RE = /\bsize\s*(\d{1,3})\b/i
  const SKU_TOKEN_RE = /\b([A-Z]{2,}[0-9]{1,3}[A-Z0-9-]{0,})\b/g

  for (const row of sample) {
    const html = await fetchHtml(row.url)
    if (!html) {
      diagnostics.push({ url: row.url, reason: 'fetch-failed' })
      continue
    }
    const $ = cheerio.load(html)
    const h1 = $('h1').first().text().trim()
    if (!h1) {
      diagnostics.push({ url: row.url, reason: 'missing-h1' })
      continue
    }
    const lower = h1.toLowerCase()
    const hasFamily = FAMILY_HINTS.some(f => lower.includes(f))
    const sizeMatch = h1.match(SIZE_RE)
    const skuTokens: string[] = []
    let m: RegExpExecArray | null
    while ((m = SKU_TOKEN_RE.exec(h1))) skuTokens.push(m[1])
    const reasons: string[] = []
    if (!hasFamily) reasons.push('no-family-hint')
    if (!sizeMatch) reasons.push('no-size')
    if (skuTokens.length === 0) reasons.push('no-sku-token')
    if (reasons.length === 0) {
      // Heuristic says this looks valid; mark as potentially-skipped
      diagnostics.push({ url: row.url, reason: 'looks-valid-but-unlinked', h1, tokens: skuTokens })
    } else {
      diagnostics.push({ url: row.url, reason: reasons.join(','), h1, tokens: skuTokens })
    }
  }

  // Aggregate skip reasons
  const reasonCounts = diagnostics.reduce<Record<string, number>>((acc, d) => {
    acc[d.reason] = (acc[d.reason] || 0) + 1
    return acc
  }, {})

  return json({
    supplierSlug,
    sourceTotals: { total: totalSources, linked: linkedSources, unlinked: unlinked.length },
    productsTotal: products.length,
    skuGrouping,
    diagnostics: { sampleSize: diagnostics.length, reasons: reasonCounts, sample: diagnostics.slice(0, 50) },
  })
}

export default function ImporterReelSeatsReconcileDiagnostics() {
  return null
}
