import { json, type ActionFunctionArgs } from '@remix-run/node'
import type { Prisma } from '@prisma/client'
import { isHqShop } from '../lib/access.server'

// POST /resources/debug/ps/ingest-seeds?supplierId=batson-reel-seats&limit=50&detailOnly=1
// HQ-only utility: ingest recent ProductSource URLs directly into product_db (and staging) without a template.
// It fetches each detail page, extracts JSON-LD, normalizes a friendly title, and writes via upsertNormalizedProduct.
export async function action({ request }: ActionFunctionArgs) {
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })

  const urlObj = new URL(request.url)
  const supplierSlug = urlObj.searchParams.get('supplierId') || 'batson-reel-seats'
  const limit = Math.max(1, Math.min(500, Number(urlObj.searchParams.get('limit') || '50')))
  const detailOnly = urlObj.searchParams.get('detailOnly') === '1'
  const sourceFilter = (urlObj.searchParams.get('source') || 'all').toLowerCase() // all|forced|discovered

  const { prisma } = await import('../db.server')

  // Resolve supplier.id from slug; default to slug-as-id when absent
  let supplierId = supplierSlug
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM Supplier WHERE slug = ? LIMIT 1',
      supplierSlug,
    )
    if (rows && rows.length) supplierId = rows[0].id
  } catch {
    /* ignore */
  }

  // Fetch candidate URLs from ProductSource; support both resolved supplierId and legacy slug-as-id
  const supplierIds = Array.from(new Set([supplierId, supplierSlug])).filter(Boolean)
  const where: string[] = []
  const params: unknown[] = []
  if (supplierIds.length === 1) {
    where.push('supplierId = ?')
    params.push(supplierIds[0])
  } else if (supplierIds.length > 1) {
    where.push(`supplierId IN (${supplierIds.map(() => '?').join(',')})`)
    params.push(...supplierIds)
  }
  if (sourceFilter === 'forced') {
    where.push("IFNULL(source,'') = 'forced'")
  } else if (sourceFilter === 'discovered') {
    where.push("IFNULL(source,'') = 'discovered'")
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  let rows: Array<{ url: string }> = []
  try {
    const sql = `SELECT url FROM ProductSource ${whereSql} LIMIT ?`
    rows = await prisma.$queryRawUnsafe<Array<{ url: string }>>(sql, ...params, limit)
  } catch {
    rows = []
  }
  // Fallback: if supplierId lookup yielded no rows (legacy/unknown supplier ids), try domain/category heuristic
  if (!rows || rows.length === 0) {
    try {
      const sql2 = `SELECT url FROM ProductSource WHERE url LIKE '%batsonenterprises.com%' AND (url LIKE '%/reel-seats%' OR url LIKE '%/ecom/%') LIMIT ?`
      rows = await prisma.$queryRawUnsafe<Array<{ url: string }>>(sql2, limit)
    } catch {
      rows = []
    }
  }

  const urls = rows.map(r => String(r.url || '').trim()).filter(Boolean)
  const unique = Array.from(new Set(urls))

  // Lightweight helper: treat as product-detail page only if path suggests detail
  const isDetailUrl = (href: string): boolean => {
    try {
      const u = new URL(href)
      const p = u.pathname.toLowerCase()
      if (/\/(products|product|ecom)\//.test(p)) return true
      if (/\/rod-blanks\//.test(p) && p !== '/rod-blanks') return true
      if (/\/reel-seats\//.test(p) && p !== '/reel-seats') return true
      return false
    } catch {
      return false
    }
  }

  const picked = detailOnly ? unique.filter(isDetailUrl) : unique
  if (!picked.length) return json({ ok: true, supplierId, attempted: 0, staged: 0, errors: 0, items: [] })

  const { upsertNormalizedProduct } = await import('../services/productDbWriter.server')
  const { linkExternalIdForSource } = await import('../../packages/importer/src/seeds/sources')
  const { extractJsonLd, mapProductFromJsonLd } = await import('../../packages/importer/src/extractors/jsonld')
  const { slugFromPath, hash: hashUrl } = await import('../../src/importer/extract/fallbacks')
  const { buildBatsonTitle } = await import('../server/importer/products/titleNormalize')

  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'

  let staged = 0
  let errors = 0
  const items: Array<{ url: string; sku?: string; ok: boolean; reason?: string }> = []

  for (const url of picked) {
    // Fetch HTML with a short timeout
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    let html = ''
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        signal: ctrl.signal,
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      html = await r.text()
    } catch (e) {
      errors++
      items.push({ url, ok: false, reason: `fetch-failed: ${(e as Error)?.message || 'error'}` })
      clearTimeout(timer)
      continue
    } finally {
      clearTimeout(timer)
    }

    try {
      const jldAll = extractJsonLd(html)
      const jld = mapProductFromJsonLd(jldAll) as Record<string, unknown> | null
      let externalId = (jld?.externalId as string | undefined)?.toString()?.trim() || ''
      if (!externalId) externalId = slugFromPath(url) || ''
      if (!externalId) externalId = hashUrl(url)
      externalId = externalId.toUpperCase().replace(/[^A-Z0-9-]+/g, '')
      if (!externalId) throw new Error('no-external-id')
      const rawSpecs = (jld?.rawSpecs as Record<string, unknown>) || {}
      const rawTitle = ((jld?.title as string) || '').trim()
      // Derive series/family heuristics for reel seats
      let seriesGuess = ((): string | undefined => {
        const fromSpec = String((rawSpecs as Record<string, unknown>)['series'] || '').trim()
        if (fromSpec) return fromSpec
        const orig = String((rawSpecs as Record<string, unknown>)['original_title'] || rawTitle || '')
        const s = orig
          .replace(/\b(Gloss\s+Black|Matte\s+Black|Black)\b\s*$/i, '')
          .replace(/[-–—]\s*$/g, '')
          .trim()
        return s || undefined
      })()
      // Header/meta fallback if series missing
      if (!seriesGuess) {
        try {
          const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
          const metaOg = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
          const head = (m?.[1] || metaOg?.[1] || '').replace(/<[^>]+>/g, '').trim()
          if (head) {
            const cleaned = head
              .replace(/\b(Gloss\s+Black|Matte\s+Black|Black)\b\s*$/i, '')
              .replace(/[-–—]\s*$/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim()
            if (cleaned) seriesGuess = cleaned
          }
        } catch {
          /* ignore */
        }
      }
      const modelGuess = ((): string | undefined => {
        const m = externalId.match(/^[A-Z]+/)
        return m ? m[0] : undefined
      })()
      const sizeGuess = ((): string | undefined => {
        const m = externalId.match(/^[A-Z]+(\d{1,2})/)
        return m ? m[1] : undefined
      })()
      const colorGuess = ((): string | undefined => {
        const c = String((rawSpecs as Record<string, unknown>)['color'] || '').trim()
        if (c) return c
        if (/\bblack\b/i.test(rawTitle)) return 'Black'
        const ot = String((rawSpecs as Record<string, unknown>)['original_title'] || '')
        if (/\bblack\b/i.test(ot)) return 'Black'
        return undefined
      })()

      const title = buildBatsonTitle({
        code: externalId,
        model: modelGuess,
        series: seriesGuess,
        size_label: sizeGuess,
        color: colorGuess,
        partType: /reel-seats/i.test(url) ? 'Reel Seat' : undefined,
      })

      // Write canonical product and link source
      try {
        await upsertNormalizedProduct({
          supplier: { id: supplierId },
          sku: externalId,
          title,
          type: /reel-seats/i.test(url) ? 'Reel Seat' : undefined,
          description: (jld?.description as string) || '',
          images: jld?.images as unknown as Prisma.InputJsonValue,
          rawSpecs: rawSpecs as unknown as Prisma.InputJsonValue,
          normSpecs: null,
          priceMsrp: (jld?.priceMsrp as number) || null,
          priceWholesale: null,
          availability: null,
          sources: [{ url, externalId, source: 'discovered' }],
          fetchedAt: new Date(),
        })
        await linkExternalIdForSource(supplierId, url, externalId, undefined)
        staged++
        items.push({ url, sku: externalId, ok: true })
      } catch (e) {
        errors++
        items.push({ url, sku: externalId, ok: false, reason: (e as Error)?.message || 'upsert-failed' })
      }
    } catch (e) {
      errors++
      items.push({ url, ok: false, reason: (e as Error)?.message || 'parse-failed' })
    }
  }

  return json({ ok: true, supplierId, attempted: picked.length, staged, errors, items: items.slice(0, 25) })
}

export default function DebugPsIngestSeeds() {
  return null
}
