import { json, type ActionFunctionArgs } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'
import { getDiscoverSiteById, getSiteConfigForUrlDiscoverV1 } from '../server/importer/sites'
import { renderHeadlessHtml } from '../server/headless/renderHeadlessHtml'
import {
  PRODUCT_MODELS,
  SHOPIFY_MAPPERS,
  type ProductModel,
  type ShopifyMapper,
} from '../server/importer/products/models'

export async function action({ request }: ActionFunctionArgs) {
  const hq = await isHqShop(request)
  const ct = request.headers.get('content-type') || ''
  const read = async () => {
    if (/application\/json/i.test(ct)) {
      const body = await request.json().catch(() => ({}))
      return body as Record<string, unknown>
    }
    const fd = await request.formData().catch(() => null)
    const o: Record<string, unknown> = {}
    if (fd) {
      const siteId = String(fd.get('siteId') || '').trim()
      const sourceUrl = String(fd.get('sourceUrl') || '').trim()
      const alsoPreview = String(fd.get('alsoPreview') || '').trim()
      const previewUrl = String(fd.get('previewUrl') || '').trim()
      const strategy = String(fd.get('strategy') || '').trim()
      const devSampleHtml = String(fd.get('devSampleHtml') || '').trim()
      if (siteId) o.siteId = siteId
      if (sourceUrl) o.sourceUrl = sourceUrl
      if (alsoPreview) o.alsoPreview = alsoPreview
      if (previewUrl) o.previewUrl = previewUrl
      if (strategy) o.strategy = strategy
      if (devSampleHtml) o.devSampleHtml = devSampleHtml
    }
    return o
  }
  const {
    siteId: siteIdRaw,
    sourceUrl: sourceUrlRaw,
    alsoPreview,
    previewUrl,
    strategy,
    devSampleHtml,
  } = (await read()) as {
    siteId?: string
    sourceUrl?: string
    alsoPreview?: string
    previewUrl?: string
    strategy?: 'static' | 'headless' | 'hybrid' | string
    devSampleHtml?: string
  }
  const siteId = (siteIdRaw || '').trim()
  const sourceUrl = (sourceUrlRaw || '').trim()
  if (!sourceUrl) return json({ urls: [], debug: { notes: ['sourceUrl missing'] } })
  if (!hq) {
    return json({ urls: [], debug: { status: 403, reason: 'hq_required' } }, { status: 403 })
  }

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }

  let staticHtml: string | null = null
  let headlessHtml: string | null = null
  const fetchHtml = async (mode: 'static' | 'headless'): Promise<string | null> => {
    if (mode === 'static') {
      if (staticHtml != null) return staticHtml
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10_000)
      try {
        const r = await fetch(sourceUrl, { headers, signal: ctrl.signal })
        if (!r.ok) return null
        const t = await r.text()
        staticHtml = t
        return t
      } catch {
        return null
      } finally {
        clearTimeout(timer)
      }
    } else {
      if (headlessHtml != null) return headlessHtml
      try {
        const t = await renderHeadlessHtml(sourceUrl, { timeoutMs: 15_000 })
        headlessHtml = t
        return t
      } catch {
        return null
      }
    }
  }

  const siteObj = (siteId ? getDiscoverSiteById(siteId) : null) || getSiteConfigForUrlDiscoverV1(sourceUrl)
  if (!siteObj || typeof siteObj.discover !== 'function') {
    return json({ urls: [], debug: { siteId: siteId || 'unknown', usedMode: 'none', notes: ['No site discoverer'] } })
  }
  const baseUrl = (() => {
    try {
      const u = new URL(sourceUrl)
      return `${u.protocol}//${u.hostname}`
    } catch {
      return 'https://batsonenterprises.com'
    }
  })()

  const res = await siteObj.discover(fetchHtml, baseUrl)
  let urls = Array.isArray(res.seeds) ? res.seeds.map((s: { url: string }) => s.url) : []
  // Enhanced pagination: follow rel=next and numbered pages iteratively (same-host), with a safety cap
  // Prefer site-provided pagination count when available; the site discovery handles pagination itself.
  const pagesVisitedRaw = (res.debug as Record<string, unknown> | undefined)?.pagesVisited as number | undefined
  const pagesVisited = Number.isFinite(pagesVisitedRaw) ? (pagesVisitedRaw as number) : 1
  urls = Array.from(new Set(urls))
  // Compare discovered vs expected results (from site debug) and emit a warning note if >5% off
  const expectedResults = (res.debug as Record<string, unknown> | undefined)?.expectedResults as
    | number
    | null
    | undefined
  const apiNotes: string[] = []
  if (typeof expectedResults === 'number' && expectedResults > 0) {
    const diff = Math.abs(urls.length - expectedResults)
    const pct = (diff / expectedResults) * 100
    if (pct > 5)
      apiNotes.push(`api: discovered ${urls.length} vs expected ${expectedResults} (diff ${pct.toFixed(1)}%)`)
  }
  // Persist discovered URLs as the category's seed set (best-effort)
  let persistedCount = 0
  let persistErrors = 0
  try {
    const supplierId = (siteId && siteId.trim()) || ((siteObj as { id?: string } | null)?.id || '').trim() || null
    if (supplierId) {
      const { upsertProductSource } = await import('../../packages/importer/src/seeds/sources')
      for (const u of urls) {
        try {
          await upsertProductSource(supplierId, u, 'discovered', 'discover:category', undefined)
          persistedCount++
        } catch {
          persistErrors++
          /* ignore individual seed errors */
        }
      }
    }
  } catch {
    /* ignore persistence errors */
  }
  const debug = {
    siteId: siteObj.id || siteId || 'unknown',
    usedMode: res.usedMode || 'none',
    strategyUsed: (res.debug as Record<string, unknown> | undefined)?.strategyUsed || 'n/a',
    totalFound: (res.debug as Record<string, unknown> | undefined)?.totalFound || urls.length,
    deduped: (res.debug as Record<string, unknown> | undefined)?.deduped || urls.length,
    sample: urls.slice(0, 5),
    htmlExcerpt: (staticHtml || headlessHtml || '').slice(0, 600),
    notes: [
      ...((((res.debug as Record<string, unknown> | undefined)?.notes as string[] | undefined) || []) as string[]),
      ...apiNotes,
    ],
    expectedResults: typeof expectedResults === 'number' ? expectedResults : undefined,
    status: 200,
    contentLength: (staticHtml || headlessHtml || '').length,
    textLength: (staticHtml || headlessHtml || '').replace(/<[^>]+>/g, '').length,
    pagesVisited,
    pageUrlsSample: Array.isArray((res.debug as Record<string, unknown> | undefined)?.pageUrls)
      ? ((res.debug as Record<string, unknown>)?.pageUrls as string[]).slice(0, 5)
      : [],
    persisted: persistedCount || undefined,
    persistErrors: persistErrors || undefined,
  }
  // Optionally include a preview for the first (or provided) series URL
  if (alsoPreview) {
    const strat = (strategy as 'static' | 'headless' | 'hybrid') || 'hybrid'
    const src = (typeof previewUrl === 'string' && previewUrl.trim()) || urls[0] || ''
    if (src) {
      // Fetch page HTML
      let html: string | null = null
      let usedModePreview: 'static' | 'headless' | 'none' = 'none'
      const fetchStatic = async (): Promise<string | null> => {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 10_000)
        try {
          const r = await fetch(src, { headers, signal: ctrl.signal })
          if (!r.ok) return null
          return await r.text()
        } catch {
          return null
        } finally {
          clearTimeout(timer)
        }
      }
      const fetchHeadless = async (): Promise<string | null> => {
        try {
          return await renderHeadlessHtml(src, { timeoutMs: 15_000 })
        } catch {
          return null
        }
      }
      if (strat === 'headless') {
        html = await fetchHeadless()
        usedModePreview = html ? 'headless' : 'none'
      } else if (strat === 'static') {
        html = await fetchStatic()
        usedModePreview = html ? 'static' : 'none'
      } else {
        html = await fetchStatic()
        usedModePreview = html ? 'static' : 'none'
        if (!html) {
          html = await fetchHeadless()
          usedModePreview = html ? 'headless' : 'none'
        }
      }
      if (html) {
        // Select model; currently Batson attribute-grid is expected on series pages
        const modelId = 'batson-attribute-grid'
        const parse: ProductModel = PRODUCT_MODELS[modelId]
        const mapToShopify: ShopifyMapper = SHOPIFY_MAPPERS[modelId]
        let { rows } = parse(html, baseUrl)
        if (strat === 'hybrid' && usedModePreview === 'static' && (!Array.isArray(rows) || rows.length === 0)) {
          const hl = await fetchHeadless()
          if (hl && hl.trim()) {
            usedModePreview = 'headless'
            rows = parse(hl, baseUrl).rows
          }
        }
        const h1 = html.match(/<h1[^>]*>([^<]{1,200})<\/h1>/i)
        const seriesTitle = (h1 && h1[1] ? h1[1].trim() : rows[0]?.spec.series || 'Series') as string
        const preview = mapToShopify(seriesTitle, rows)
        const debugPreview = {
          count: rows.length,
          urlUsed: src,
          seriesTitle,
          modelId,
          htmlExcerpt: devSampleHtml ? html.slice(0, 2048) : undefined,
          usedMode: usedModePreview,
        }
        return json({ urls, debug, preview: { rows, preview, debug: debugPreview } })
      }
    }
  }
  return json({ urls, debug })
}

// resource route (no default export)
