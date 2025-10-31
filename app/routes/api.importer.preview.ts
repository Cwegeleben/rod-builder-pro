// hq-importer-new-import-v2
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getScraperById, listScrapers, type Scraper } from '../services/importer/scrapers.server'
import { fetchActiveSources } from '../../packages/importer/src/seeds/sources'
import { fetchPage } from '../services/importer/fetchPage'
import { extractJsonLd } from '../../packages/importer/src/extractors/jsonld'
import { getTemplateWithFields } from '../models/specTemplate.server'
import { slugifyTemplateName } from '../models/specTemplateCoreFields'
import { prisma } from '../db.server'
import {
  mapAttributesToTemplate,
  normalizeLabel as normalizeLabelShared,
  type TemplateFieldMeta,
  type AliasMemory,
} from '../services/importer/zeroConfigMapper.server'
import {
  loadTemplateAliases,
  rememberTemplateAlias,
  saveRunMappingSnapshot,
} from '../models/importerMappingSnapshot.server'
// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 (wire-preview-imports) -->
import { matchTemplateFieldsFromKV } from '../../src/importer/mapping/labelDrivenMatcher'
import { BatsonBlanksTemplateFields } from '../../src/importer/templates/batson/blanksTemplate'
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 (wire-preview-imports) -->

type FieldSource = 'jsonld' | 'microdata' | 'dom' | 'heuristic' | 'none'
type ItemStatus = 'ok' | 'partial' | 'error'
type Diagnostics = {
  strategy: Scraper['id']
  sources: Partial<Record<'title' | 'sku' | 'price' | 'currency' | 'options' | 'images', FieldSource>>
  missing: string[]
  notes?: string[]
  mappedKeys?: Record<string, string>
}

type PreviewItem = {
  title?: string | null
  sku?: string | null
  price?: number | null
  currency?: string | null
  msrp?: number | null
  availability?: string | null
  options?: { o1?: string | null; o2?: string | null; o3?: string | null }
  images?: string[]
  attributes?: Record<string, string | string[]>
  externalId?: string | null
  url: string
  status: ItemStatus
  diagnostics: Diagnostics
  raw?: { jsonld?: unknown; microdata?: unknown; domSample?: string }
  fieldValues?: Record<string, string | number | null>
  unmatched?: Array<{ label: string; sample: string | null }>
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const ct = request.headers.get('content-type') || ''
  const read = async () => {
    if (/application\/json/i.test(ct)) {
      const body = await request.json().catch(() => ({}))
      return body as Record<string, unknown>
    }
    const fd = await request.formData().catch(() => null)
    const o: Record<string, unknown> = {}
    if (fd) {
      o.variantTemplateId = String(fd.get('variantTemplateId') || '') || undefined
      o.scraperId = String(fd.get('scraperId') || '') || undefined
      o.includeDiscovered = fd.get('includeDiscovered') === 'on'
      o.skipSuccessful = fd.get('skipSuccessful') === 'on'
      const runId = String(fd.get('runId') || '').trim()
      if (runId) o.runId = runId
      const manual = String(fd.get('manualMappings') || '').trim()
      if (manual) {
        try {
          o.manualMappings = JSON.parse(manual)
        } catch {
          o.manualMappings = []
        }
      }
      if (fd.get('rememberAliases') === 'on') o.rememberAliases = true
      try {
        o.urls = JSON.parse(String(fd.get('urls') || '[]'))
      } catch {
        o.urls = []
      }
    }
    return o
  }
  const {
    variantTemplateId,
    scraperId,
    urls: rawUrls,
    includeDiscovered,
    skipSuccessful,
    runId: runIdRaw,
    manualMappings,
    rememberAliases,
    // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
    templateId,
    mode,
    devSampleHtml,
    strategy,
    scrapeType,
    sourceUrl,
    // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
  } = (await read()) as {
    variantTemplateId?: string
    scraperId?: string
    urls?: string[]
    includeDiscovered?: boolean
    skipSuccessful?: boolean
    runId?: string
    manualMappings?: Array<{ label: string; fieldKey: string }>
    rememberAliases?: boolean
    // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
    templateId?: string
    mode?: string
    devSampleHtml?: boolean
    strategy?: 'static' | 'headless' | 'hybrid'
    scrapeType?: 'auto' | 'batson-attribute-grid'
    sourceUrl?: string
    seriesUrls?: string[]
    // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
  }

  // Compose URL set
  const manual = Array.isArray(rawUrls) ? (rawUrls as string[]) : []
  const supplierId = 'batson' // current supplier scope; scrapers are generic
  const saved = includeDiscovered ? (await fetchActiveSources(supplierId)).map((s: { url: string }) => s.url) : []
  const urls = Array.from(new Set([...saved, ...manual])).slice(0, 50)
  // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
  // Special mode: series-preview (Crawl #2) — scrape first series page and map to template fields
  if (mode === 'series-preview') {
    const tplId = templateId || variantTemplateId || ''
    const src = typeof sourceUrl === 'string' && sourceUrl.trim() ? sourceUrl.trim() : ''
    const first = src || (Array.isArray(rawUrls) && rawUrls.length ? rawUrls[0] : '')
    if (!tplId) return json({ error: 'templateId required' }, { status: 400 })
    if (!first) return json({ products: [], mappingPreview: [], meta: { templateId: tplId, reason: 'no-url' } })

    const base = 'https://batsonenterprises.com'
    const strat = (strategy as 'static' | 'headless' | 'hybrid') || 'hybrid'
    let st = scrapeType as 'auto' | 'batson-attribute-grid' | undefined
    if (!st) {
      try {
        const { getSiteConfigForUrl } = await import('../server/importer/sites')
        const siteCfg = getSiteConfigForUrl(first)
        st = siteCfg.products.scrapeType
      } catch {
        st = 'auto'
      }
    }
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let html = ''
    let parserId: string | undefined
    let siteTag: string | undefined
    try {
      // If site-specific Attribute-grid is selected, force static fetch
      const r = await fetch(first, { headers, signal: ctrl.signal })
      if (!r.ok) {
        return json(
          { products: [], mappingPreview: [], meta: { templateId: tplId, urlUsed: first, status: r.status } },
          { status: 502 },
        )
      }
      html = await r.text()
    } finally {
      clearTimeout(timer)
    }
    // Choose parser: site-specific vs general seriesProducts
    let seriesProducts: Array<{
      title?: string | null
      url: string
      price?: number | null
      status?: string | null
      raw?: Record<string, string>
      specs?: Record<string, unknown>
    }>
    if (st === 'batson-attribute-grid') {
      const mod = await import('../server/importer/preview/parsers/batsonAttributeGrid')
      const rows = mod.extractBatsonAttributeGrid(html, base)
      parserId = mod.PARSER_ID
      siteTag = mod.SITE_TAG
      // Adapt to common shape
      seriesProducts = rows.map(r => ({
        title: r.title || null,
        url: r.url,
        price: r.price ?? null,
        status: r.status ?? null,
        raw: r.raw,
        specs: r.specs,
      }))
    } else {
      const { extractSeriesProducts } = await import('../server/importer/preview/seriesProducts')
      seriesProducts = extractSeriesProducts(html, base)
    }
    const responseMeta: Record<string, unknown> = {
      templateId: tplId,
      urlUsed: first,
      parserId,
      siteTag,
      strategy: st === 'batson-attribute-grid' ? 'static' : strat,
      scrapeType: st,
    }
    // Fallback: if zero products, the provided URL might be a category/listing page.
    // Try to discover series links within the page and fetch the first, then extract.
    if (!seriesProducts.length && st !== 'batson-attribute-grid') {
      try {
        const { crawlBatsonRodBlanksListing } = await import('../server/importer/crawlers/batsonListing')
        const seriesLinks = crawlBatsonRodBlanksListing(html, base)
        const firstSeries = Array.isArray(seriesLinks) && seriesLinks.length ? seriesLinks[0] : ''
        if (firstSeries) {
          const ctrl2 = new AbortController()
          const timer2 = setTimeout(() => ctrl2.abort(), 8000)
          try {
            const r2 = await fetch(firstSeries, { headers, signal: ctrl2.signal })
            if (r2.ok) {
              const html2 = await r2.text()
              const { extractSeriesProducts } = await import('../server/importer/preview/seriesProducts')
              seriesProducts = extractSeriesProducts(html2, base)
              // Record that we followed a listing link to a series URL
              ;(responseMeta as Record<string, unknown>).followed = firstSeries
            }
          } finally {
            clearTimeout(timer2)
          }
        }
      } catch {
        // ignore fallback errors; return empty as before
      }
    }
    // Build products for UI grid
    const products = seriesProducts.map(p => ({
      title: p.title,
      price: p.price ?? null,
      status: p.status ?? null,
      url: p.url,
    }))
    // Label-driven mapping preview using existing matcher if available
    // Fetch template fields for mapping/missingFields summary
    let tplFieldsForPreview: Array<{ id: string; label: string }> = []
    try {
      const tpl = await getTemplateWithFields(tplId)
      if (tpl?.fields?.length)
        tplFieldsForPreview = tpl.fields.map((f: { key: string; label: string }) => ({ id: f.key, label: f.label }))
    } catch {
      /* ignore */
    }

    const mappingPreview = (() => {
      try {
        if (!seriesProducts.length)
          return [] as Array<{ field: string; value: string | number | null; matchedBy?: string; url: string }>
        const rows = seriesProducts.slice(0, 10)
        const out: Array<{ field: string; value: string | number | null; matchedBy?: string; url: string }> = []
        const matched = new Set<string>()
        for (const row of rows) {
          const raw =
            (row.raw && Object.keys(row.raw).length ? row.raw : (row.specs as Record<string, string> | undefined)) ||
            undefined
          if (!raw) continue
          const lr = matchTemplateFieldsFromKV?.(BatsonBlanksTemplateFields, raw as Record<string, string>)
          if (!lr || !Array.isArray(lr.mapped)) continue
          for (const m of lr.mapped) {
            const val =
              typeof m.value === 'number' || typeof m.value === 'string'
                ? (m.value as number | string)
                : (m.rawValue as string | number | null)
            out.push({ field: m.key, value: val ?? null, matchedBy: m.sourceLabel, url: row.url })
            matched.add(m.key)
            if (out.length >= 50) break
          }
          if (out.length >= 50) break
        }
        // Compute missing fields vs template (if available)
        const missing = tplFieldsForPreview.length
          ? tplFieldsForPreview.filter(f => !matched.has(f.id)).map(f => f.id)
          : []
        ;(responseMeta as Record<string, unknown>).missingFields = missing
        return out
      } catch {
        return []
      }
    })()
    ;(responseMeta as Record<string, unknown>).count = seriesProducts.length
    const response: {
      products: typeof products
      mappingPreview: typeof mappingPreview
      meta: Record<string, unknown>
      debug?: Record<string, unknown>
    } = {
      products,
      mappingPreview,
      meta: responseMeta,
    }
    if (devSampleHtml) response.debug = { htmlExcerpt: html.slice(0, 4096) }
    return json(response)
  }
  // New mode: crawl multiple series URLs and return up to 10 products total
  if (mode === 'series-products') {
    const tplId = templateId || variantTemplateId || ''
    const base = 'https://batsonenterprises.com'
    const strat = (strategy as 'static' | 'headless' | 'hybrid') || 'hybrid'
    let st = scrapeType as 'auto' | 'batson-attribute-grid' | undefined
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    }
    // Series list precedence: provided seriesUrls -> discovered from sourceUrl (if listing) -> rawUrls
    let seriesList: string[] = Array.isArray((read as unknown as { seriesUrls?: string[] }).seriesUrls)
      ? (((read as unknown as { seriesUrls?: string[] }).seriesUrls as string[]).filter(
          u => typeof u === 'string' && u.trim().length,
        ) as string[])
      : []
    const src = typeof sourceUrl === 'string' && sourceUrl.trim() ? sourceUrl.trim() : ''
    let html0 = ''
    if (!seriesList.length && src) {
      // Try to discover from provided sourceUrl
      const ctrl0 = new AbortController()
      const timer0 = setTimeout(() => ctrl0.abort(), 8000)
      try {
        const r0 = await fetch(src, { headers, signal: ctrl0.signal })
        if (r0.ok) {
          html0 = await r0.text()
          try {
            const { crawlBatsonRodBlanksListing } = await import('../server/importer/crawlers/batsonListing')
            seriesList = crawlBatsonRodBlanksListing(html0, base)
          } catch {
            // ignore
          }
        }
      } finally {
        clearTimeout(timer0)
      }
    }
    // Resolve default scrape type from site config if not provided
    if (!st) {
      try {
        const { getSiteConfigForUrl } = await import('../server/importer/sites')
        const urlForCfg = seriesList[0] || src || rawUrls?.[0] || ''
        if (urlForCfg) {
          const siteCfg = getSiteConfigForUrl(urlForCfg)
          st = siteCfg.products.scrapeType
        }
      } catch {
        st = 'auto'
      }
    }
    if (!seriesList.length && Array.isArray(rawUrls) && rawUrls.length) {
      seriesList = rawUrls
    }
    const seriesTotal = seriesList.length
    const limitTotal = 10
    const productsAll: Array<{
      title?: string | null
      url: string
      price?: number | null
      status?: string | null
      raw?: Record<string, string>
      specs?: Record<string, unknown>
    }> = []
    let visited = 0
    // Iterate series until we have up to 10 products
    for (const su of seriesList) {
      if (productsAll.length >= limitTotal) break
      const u = su.trim()
      if (!u) continue
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      try {
        const r = await fetch(u, { headers, signal: ctrl.signal })
        if (!r.ok) continue
        const html = await r.text()
        let seriesProducts: Array<{
          title?: string | null
          url: string
          price?: number | null
          status?: string | null
          raw?: Record<string, string>
          specs?: Record<string, unknown>
        }>
        if (st === 'batson-attribute-grid') {
          const mod = await import('../server/importer/preview/parsers/batsonAttributeGrid')
          const rows = mod.extractBatsonAttributeGrid(html, base)
          seriesProducts = rows.map(r => ({
            title: r.title || null,
            url: r.url,
            price: r.price ?? null,
            status: r.status ?? null,
            raw: r.raw,
            specs: r.specs,
          }))
        } else {
          const { extractSeriesProducts } = await import('../server/importer/preview/seriesProducts')
          seriesProducts = extractSeriesProducts(html, base)
        }
        productsAll.push(...seriesProducts)
        visited++
      } catch {
        // ignore series errors to continue
      } finally {
        clearTimeout(timer)
      }
    }
    // Enforce global limit
    const enrichedLimited = productsAll.slice(0, limitTotal)
    // Build UI products array
    const products = enrichedLimited.map(p => ({
      title: p.title,
      price: p.price ?? null,
      status: p.status ?? null,
      url: p.url,
    }))
    // Template fields for coverage
    let tplFieldsForPreview: Array<{ id: string; label: string }> = []
    try {
      if (tplId) {
        const tpl = await getTemplateWithFields(tplId)
        if (tpl?.fields?.length)
          tplFieldsForPreview = tpl.fields.map((f: { key: string; label: string }) => ({ id: f.key, label: f.label }))
      }
    } catch {
      /* ignore */
    }
    // Mapping preview using label-driven matcher if possible, from first few rows
    const responseMeta: Record<string, unknown> = {
      templateId: tplId,
      scrapeType: st,
      strategy: st === 'batson-attribute-grid' ? 'static' : strat,
      seriesTotal,
      seriesVisited: visited,
    }
    const mappingPreview = (() => {
      try {
        if (!enrichedLimited.length)
          return [] as Array<{ field: string; value: string | number | null; matchedBy?: string; url: string }>
        const rows = enrichedLimited.slice(0, 10)
        const out: Array<{ field: string; value: string | number | null; matchedBy?: string; url: string }> = []
        const matched = new Set<string>()
        for (const row of rows) {
          const raw =
            (row.raw && Object.keys(row.raw).length ? row.raw : (row.specs as Record<string, string> | undefined)) ||
            undefined
          if (!raw) continue
          const lr = matchTemplateFieldsFromKV?.(BatsonBlanksTemplateFields, raw as Record<string, string>)
          if (!lr || !Array.isArray(lr.mapped)) continue
          for (const m of lr.mapped) {
            const val =
              typeof m.value === 'number' || typeof m.value === 'string'
                ? (m.value as number | string)
                : (m.rawValue as string | number | null)
            out.push({ field: m.key, value: val ?? null, matchedBy: m.sourceLabel, url: row.url })
            matched.add(m.key)
            if (out.length >= 50) break
          }
          if (out.length >= 50) break
        }
        const missing = tplFieldsForPreview.length
          ? tplFieldsForPreview.filter(f => !matched.has(f.id)).map(f => f.id)
          : []
        ;(responseMeta as Record<string, unknown>).missingFields = missing
        return out
      } catch {
        return []
      }
    })()
    ;(responseMeta as Record<string, unknown>).count = enrichedLimited.length
    const response: {
      products: typeof products
      mappingPreview: typeof mappingPreview
      meta: Record<string, unknown>
      debug?: Record<string, unknown>
    } = {
      products,
      mappingPreview,
      meta: responseMeta,
    }
    if (devSampleHtml && html0) response.debug = { htmlExcerpt: html0.slice(0, 4096) }
    return json(response)
  }
  // Default mode continues below

  // If explicit urls are provided, limit preview work to the first URL only for a fast preflight
  const limitToFirst = Array.isArray(rawUrls) && rawUrls.length > 0
  const urlsForPreview = limitToFirst ? [urls[0]].filter(Boolean) : urls
  // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

  // Resolve scraper (default to jsonld)
  const scraper = (await getScraperById(scraperId || '')) || (await listScrapers()).find(s => s.id === 'jsonld-basic')!

  const items: PreviewItem[] = []
  const errors: { url: string; message: string }[] = []
  // Capture options for diagnostics
  const tplIdForNotes = variantTemplateId || null
  const skipSuccessfulFlag = !!skipSuccessful
  // Template V2 (optional)
  type TemplateV2 = {
    templateKey?: string
    version?: number
    pageTypes?: string[]
    fields?: Array<{
      id: string
      label: string
      required?: boolean
      transform?: string[]
      sources?: Array<Record<string, unknown>>
    }>
  }
  let templateV2: TemplateV2 | null = null
  if (variantTemplateId) {
    try {
      const ver = await prisma.templateVersion.findFirst({
        where: { templateId: variantTemplateId },
        orderBy: { versionNumber: 'desc' },
        select: { dataJson: true },
      })
      if (ver?.dataJson) {
        try {
          templateV2 = JSON.parse(ver.dataJson) as TemplateV2
        } catch {
          templateV2 = null
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Normalizers and helpers
  const clampLen = (s: string, max = 2000) => (s.length > max ? s.slice(0, max) : s)
  const toAbs = (src: string, base: string) => {
    try {
      return new URL(src, base).toString()
    } catch {
      return src
    }
  }
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return Math.abs(h).toString(36)
  }
  const normPrice = (v: unknown): number | null => {
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const m = v.replace(/[,\s]/g, '').match(/([0-9]+(?:\.[0-9]+)?)/)
      return m ? Number(m[1]) : null
    }
    return null
  }
  const detectCurrency = (offer: unknown): string | null => {
    if (!offer || typeof offer !== 'object') return null
    const rec = offer as Record<string, unknown>
    const code = (rec.priceCurrency || rec.currency || rec.currencyCode) as string | undefined
    return typeof code === 'string' ? code.toUpperCase().slice(0, 3) : null
  }

  // Label normalization helpers for template-aware mapping
  function normalizeLabel(label: string): string {
    const s = normalizeLabelShared(label)
    return s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  }
  function pushAttr(map: Record<string, string | string[]>, key: string, val: string) {
    const k = normalizeLabel(key)
    const v = val.trim().replace(/\s+/g, ' ')
    if (!map[k]) map[k] = v
    else if (Array.isArray(map[k])) (map[k] as string[]).push(v)
    else map[k] = [map[k] as string, v]
  }

  // Minimal transform set
  const transforms = {
    toNumber: (v: unknown) => (v == null ? null : (normPrice(String(v)) as number | null)),
    toInt: (v: unknown) => {
      if (v == null) return null
      const m = String(v).match(/(-?\d+)/)
      return m ? Number(m[1]) : null
    },
    toLengthInches: (v: unknown) => {
      if (v == null) return null
      const s = String(v)
      const ftIn = s.match(/(\d+)\s*'\s*(\d{1,2})/)
      if (ftIn) return Number(ftIn[1]) * 12 + Number(ftIn[2])
      const onlyIn = s.match(/(\d+\.?\d*)\s*(?:in|inch|inches)/i)
      if (onlyIn) return Math.round(Number(onlyIn[1]))
      return null
    },
    parseLineRange: (v: unknown) => (v == null ? null : String(v)),
    parseLureRange: (v: unknown) => (v == null ? null : String(v)),
    toSchemaAvailability: (v: unknown) => {
      const s = String(v || '').toLowerCase()
      if (!s) return null
      if (s.includes('in stock')) return 'InStock'
      if (s.includes('backorder')) return 'BackOrder'
      if (s.includes('out of stock') || s.includes('unavailable')) return 'OutOfStock'
      return 'Unknown'
    },
  }

  function applyTransforms(val: unknown, list?: string[]): string | number | null {
    if (!list || !list.length) return (val as string | number | null) ?? null
    let cur: unknown = val
    for (const t of list) {
      const fn = (transforms as Record<string, (x: unknown) => unknown>)[t]
      if (fn) cur = fn(cur)
    }
    return (cur as string | number | null) ?? null
  }

  // Apply Template V2 field evaluation if available
  function evaluateTemplateV2Fields(item: PreviewItem): PreviewItem {
    if (!templateV2 || !templateV2.fields || !templateV2.fields.length) return item
    const attrs = item.attributes || {}
    const outVals: Record<string, string | number | null> = {}
    const mapped: Record<string, string> = { ...(item.diagnostics.mappedKeys || {}) }
    const missingTpl: string[] = []

    const readAttr = (k: string): string | null => {
      const nk = normalizeLabel(k)
      const v = attrs[nk]
      if (v == null) return null
      return Array.isArray(v) ? v[0] || null : (v as string)
    }

    const readFromItem = (from: string): unknown => {
      if (from === 'sku') return item.sku
      if (from === 'price') return item.price
      if (from === 'title') return item.title
      if (from === 'availability') return item.availability
      if (from === 'externalId') return item.externalId
      if (from === 'option1') return item.options?.o1
      if (from === 'option2') return item.options?.o2
      if (from === 'option3') return item.options?.o3
      return null
    }

    // Helpers for template-aware attribute fallbacks
    const tplKey = (templateV2 as { templateKey?: string }).templateKey || null
    const fieldIdToSuffix = (id: string) => {
      const nid = normalizeLabel(id)
      if (tplKey) {
        const p = normalizeLabel(tplKey) + '_'
        return nid.startsWith(p) ? nid.slice(p.length) : nid
      }
      // If no explicit templateKey, strip a leading prefix up to the first underscore
      const i = nid.indexOf('_')
      return i > 0 ? nid.slice(i + 1) : nid
    }
    const suffixSynonyms: Record<string, string[]> = {
      // common Batson blanks grid attribute mappings
      length: ['item_length_in', 'length'],
      power: ['power'],
      action: ['action'],
      pieces: ['number_of_pieces', 'pieces'],
      blank_color: ['rod_blank_color', 'blank_color'],
      material: ['material'],
      line_rating: ['line_rating_lbs', 'line_rating'],
      lure_rating: ['lure_weight_rating_oz', 'lure_rating'],
      weight: ['weight_oz', 'weight'],
      butt_diameter: ['butt_diameter'],
      tip_top: ['tip_top_size', 'tip_top'],
      // core fields
      primary_variant_sku: [],
      primary_variant_price: [],
    }

    for (const f of templateV2.fields) {
      let value: unknown = null
      let sourceUsed: string | null = null
      // Try declared sources first
      if (Array.isArray(f.sources)) {
        for (const s of f.sources) {
          const src = s as {
            gridKey?: unknown
            attribute?: unknown
            from?: unknown
            const?: unknown
            constant?: unknown
          }
          if (typeof src.gridKey === 'string') {
            value = readAttr(String(src.gridKey))
            sourceUsed = `gridKey:${src.gridKey}`
          } else if (typeof src.attribute === 'string') {
            value = readAttr(String(src.attribute))
            sourceUsed = `attribute:${src.attribute}`
          } else if (typeof src.from === 'string') {
            value = readFromItem(String(src.from))
            sourceUsed = `from:${src.from}`
          } else if (src.const != null || src.constant != null) {
            value = (src.const as unknown) ?? src.constant
            sourceUsed = 'const'
          }
          if (value != null && value !== '') break
        }
      }
      // Fallbacks: try id/label against attributes
      if (value == null || value === '') {
        // 1) direct attribute by id/label
        value = readAttr(f.id) ?? readAttr(f.label)
        if (value != null && value !== '') sourceUsed = 'fallback:attributes'
      }
      if (value == null || value === '') {
        // 2) suffix-based attribute synonyms (e.g., batson_blanks_length -> length, item_length_in)
        const suf = fieldIdToSuffix(f.id)
        const syns = suffixSynonyms[suf]
        if (Array.isArray(syns) && syns.length) {
          for (const key of syns) {
            const v = readAttr(key)
            if (v != null && v !== '') {
              value = v
              sourceUsed = `fallback:suffix:${suf}`
              break
            }
          }
        }
      }
      if (value == null || value === '') {
        // 3) core field mirrors from the item
        const suf = fieldIdToSuffix(f.id)
        if (suf === 'primary_variant_sku') {
          value = item.sku ?? null
          if (value != null && value !== '') sourceUsed = 'fallback:item:sku'
        } else if (suf === 'primary_variant_price') {
          value = item.price ?? null
          if (value != null && value !== '') sourceUsed = 'fallback:item:price'
        }
      }

      // Apply transforms if any
      const finalVal = applyTransforms(value, f.transform)
      outVals[f.id] = finalVal
      if (sourceUsed) mapped[f.id] = sourceUsed
      if (f.required && (finalVal == null || finalVal === '')) missingTpl.push(`tplV2:${f.id}`)
    }

    const diagMissing = Array.from(new Set([...(item.diagnostics.missing || []), ...missingTpl]))
    return {
      ...item,
      fieldValues: outVals,
      diagnostics: {
        ...item.diagnostics,
        mappedKeys: Object.keys(mapped).length ? mapped : item.diagnostics.mappedKeys,
        missing: diagMissing,
      },
    }
  }

  // Microdata quick-scan (very lightweight; best-effort)
  const extractMicrodata = (html: string) => {
    // Look for common itemprop meta tags
    const take = (prop: string) => {
      const re = new RegExp(
        `<(?:meta|span|div)[^>]*itemprop=["']${prop}["'][^>]*?(?:content=["']([^"']+)["']|>([^<]+)<)`,
        'i',
      )
      const m = html.match(re)
      return m ? (m[1] || m[2] || '').trim() : null
    }
    const name = take('name')
    const sku = take('sku')
    const priceVal = take('price')
    const currency = take('priceCurrency')
    // image(s)
    const imgRe = /<img[^>]*itemprop=["']image["'][^>]*src=["']([^"']+)["'][^>]*>/gi
    const imgs: string[] = []
    let im: RegExpExecArray | null
    while ((im = imgRe.exec(html))) imgs.push(im[1])
    return {
      title: name || null,
      sku: sku || null,
      price: normPrice(priceVal),
      currency: currency ? currency.toUpperCase() : null,
      images: imgs,
    }
  }

  const parseListLinks = (html: string, baseUrl: string) => {
    // Heuristic: collect likely product links
    const out: string[] = []
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const href = m[1]
      const abs = href.startsWith('http') ? href : toAbs(href, baseUrl)
      if (/\/products\//i.test(abs) || /\bproduct\b/i.test(m[2] || '')) out.push(abs)
    }
    return Array.from(new Set(out))
  }

  const buildItem = (
    base: Partial<PreviewItem> & { url: string },
    used: Diagnostics['sources'],
    scraperId: Scraper['id'],
  ): PreviewItem => {
    // Determine status and missing reasons
    const missing: string[] = []
    const sources = {
      title: 'none',
      sku: 'none',
      price: 'none',
      currency: 'none',
      options: 'none',
      images: 'none',
      ...used,
    } as Diagnostics['sources']
    const title = (base.title ?? null) as string | null
    let sku = (base.sku ?? null) as string | null
    const price = base.price ?? null
    const currency = (base.currency ?? null) as string | null
    const options = base.options || { o1: null, o2: null, o3: null }
    const images = (base.images || []).map(src => toAbs(src, base.url))

    if (!title) missing.push('title:not_found')
    if (!price) missing.push('price:not_found')
    if (!sku) {
      // Generate placeholder
      sku = `TEMP-${hash(`${title || ''}|${base.url}`)}`
      missing.push('sku:generated')
    }
    const optionsMissing: string[] = []
    if (!options.o1) optionsMissing.push('o1')
    if (!options.o2) optionsMissing.push('o2')
    if (optionsMissing.length) missing.push(`options:partial(${optionsMissing.join(',')})`)
    if (!images.length) missing.push('images:not_found')

    const status: ItemStatus = missing.length === 0 ? 'ok' : missing.length < 3 ? 'partial' : 'partial'

    const notes: string[] = []
    if (tplIdForNotes) notes.push(`template:${tplIdForNotes}`)
    if (skipSuccessfulFlag) notes.push('skipSuccessful:on')

    return {
      title,
      sku,
      price,
      currency,
      options,
      images,
      url: base.url,
      status,
      diagnostics: {
        strategy: scraperId,
        sources,
        missing,
        notes: notes.length ? notes : undefined,
      },
      raw: base.raw,
    }
  }

  async function runJsonLd(url: string, scraperId: Scraper['id']) {
    const page = await fetchPage({ url, snapshotMaxLength: 250_000 })
    if (page.disallowed) {
      errors.push({ url, message: 'Blocked by robots.txt' })
      return [] as PreviewItem[]
    }
    const jsonldNodes = extractJsonLd(page.html)
    const itemsOut: PreviewItem[] = []
    // Gather product-like entries
    const nodes = Array.isArray(jsonldNodes) ? jsonldNodes : []
    const rawBlob = nodes.length ? { jsonld: clampLen(JSON.stringify(nodes)).toString() } : undefined
    for (const n of nodes as Array<Record<string, unknown>>) {
      const t = (n['@type'] || n['type'] || '').toString().toLowerCase()
      if (t.includes('product') || n['sku'] || n['name']) {
        const offersAny = Array.isArray(n.offers) ? (n.offers as unknown[]) : n.offers ? [n.offers as unknown] : []
        const images: string[] = Array.isArray(n.image) ? (n.image as string[]) : n.image ? [String(n.image)] : []

        if (offersAny.length > 1) {
          // Emit one row per offer (variant-like)
          for (const off of offersAny) {
            const rec = off && typeof off === 'object' ? (off as Record<string, unknown>) : {}
            const priceVal = normPrice(rec.price)
            const currency = detectCurrency(off) || null
            const offerSku = (rec.sku as string | undefined) || undefined
            const row = buildItem(
              {
                url: (n.url as string) || url,
                title: (n.name as string) || null,
                sku:
                  offerSku ||
                  (((n as Record<string, unknown>).sku ||
                    (n as Record<string, unknown>).mpn ||
                    (n as Record<string, unknown>).productID ||
                    null) as string | null),
                price: priceVal,
                currency,
                options: { o1: null, o2: null, o3: null },
                images,
                raw: rawBlob ? { jsonld: nodes } : undefined,
              },
              {
                title: 'jsonld',
                sku: offerSku ? 'jsonld' : 'jsonld',
                price: priceVal ? 'jsonld' : 'none',
                currency: currency ? 'jsonld' : 'none',
                images: images.length ? 'jsonld' : 'none',
              },
              scraperId,
            )
            itemsOut.push(evaluateTemplateV2Fields(row))
          }
        } else {
          const offer = offersAny[0]
          const offerRec = offer && typeof offer === 'object' ? (offer as Record<string, unknown>) : {}
          const priceVal = normPrice(offerRec.price)
          const currency = detectCurrency(offer) || null
          const row = buildItem(
            {
              url: (n.url as string) || url,
              title: (n.name as string) || null,
              sku: ((n as Record<string, unknown>).sku ||
                (n as Record<string, unknown>).mpn ||
                (n as Record<string, unknown>).productID ||
                null) as string | null,
              price: priceVal,
              currency,
              options: { o1: null, o2: null, o3: null },
              images,
              raw: rawBlob ? { jsonld: nodes } : undefined,
            },
            {
              title: 'jsonld',
              sku: 'jsonld',
              price: priceVal ? 'jsonld' : 'none',
              currency: currency ? 'jsonld' : 'none',
              images: images.length ? 'jsonld' : 'none',
            },
            scraperId,
          )
          itemsOut.push(evaluateTemplateV2Fields(row))
        }
      }
      if (t.includes('itemlist') && Array.isArray(n['itemListElement'])) {
        for (const el of n['itemListElement']) {
          const it = el?.item || el
          if (it?.url || it?.name) {
            const row = buildItem(
              {
                url: it.url ? toAbs(it.url, url) : url,
                title: it.name || null,
                images: [],
                options: { o1: null, o2: null, o3: null },
                raw: rawBlob ? { jsonld: nodes } : undefined,
              },
              { title: 'jsonld' },
              scraperId,
            )
            itemsOut.push(evaluateTemplateV2Fields(row))
          }
        }
      }
    }
    // Microdata fallback if nothing found
    if (!itemsOut.length) {
      const md = extractMicrodata(page.html)
      if (md.title || md.sku || md.price || (md.images && md.images.length)) {
        itemsOut.push(
          evaluateTemplateV2Fields(
            buildItem(
              { url, ...md, raw: { microdata: clampLen(JSON.stringify(md)) } },
              {
                title: md.title ? 'microdata' : 'none',
                sku: md.sku ? 'microdata' : 'none',
                price: md.price ? 'microdata' : 'none',
                currency: md.currency ? 'microdata' : 'none',
                images: md.images?.length ? 'microdata' : 'none',
              },
              scraperId,
            ),
          ),
        )
      }
    }
    return itemsOut
  }

  async function runDom(url: string, scraperId: Scraper['id']) {
    const page = await fetchPage({ url, snapshotMaxLength: 200_000 })
    if (page.disallowed) {
      errors.push({ url, message: 'Blocked by robots.txt' })
      return [] as PreviewItem[]
    }
    // Very light DOM heuristics without dependencies
    // Title from <h1>
    const tMatch = page.html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const title = tMatch ? tMatch[1].trim() : null
    // Price: look for data-price/price meta or $-like
    const pMeta = page.html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
    const pSpan = page.html.match(/class=["'][^"']*price[^"']*["'][^>]*>([^<]{1,32})<\/[^>]+>/i)
    const price = normPrice(pMeta?.[1] || pSpan?.[1] || null)
    // SKU: common field
    const skuMeta = page.html.match(/itemprop=["']sku["'][^>]*content=["']([^"']+)["']/i)
    const skuText = page.html.match(/SKU\s*[:#-]?\s*<\/?[^>]*>([^<]{2,})/i)
    const sku = (skuMeta?.[1] || skuText?.[1] || '').trim() || null
    // Images
    const imgs: string[] = []
    const imgRe = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
    let im: RegExpExecArray | null
    while ((im = imgRe.exec(page.html))) imgs.push(im[1])

    const raw = { domSample: clampLen(page.html.slice(0, 4000)) }
    return [
      evaluateTemplateV2Fields(
        buildItem(
          { url, title, sku, price, images: imgs, options: { o1: null, o2: null, o3: null }, raw },
          {
            title: title ? 'dom' : 'none',
            sku: sku ? 'dom' : 'none',
            price: price ? 'dom' : 'none',
            images: imgs.length ? 'dom' : 'none',
          },
          scraperId,
        ),
      ),
    ]
  }

  async function applyTemplateMapping(variantTemplateId: string | undefined, base: PreviewItem): Promise<PreviewItem> {
    if (!variantTemplateId) return base
    const tpl = await getTemplateWithFields(variantTemplateId).catch(() => null)
    if (!tpl) return base

    const prefix = slugifyTemplateName(tpl.name || 'template')
    const fields = tpl.fields || []
    const byLabel = new Map<string, (typeof fields)[number]>()
    const byKey = new Map<string, (typeof fields)[number]>()
    for (const f of fields) {
      byLabel.set(normalizeLabel(f.label), f)
      const suffix = f.key.startsWith(prefix + '_') ? f.key.slice(prefix.length + 1) : f.key
      byKey.set(normalizeLabel(suffix), f)
    }
    // Zero-config mapper: use shared matcher with alias memory
    const tplFields: TemplateFieldMeta[] = fields.map(f => ({ key: f.key, label: f.label, required: f.required }))
    const attributesRaw = base.attributes || {}
    // Build alias memory from global TemplateAlias + any manualMappings passed in for this preview
    let aliasMemory: AliasMemory = []
    try {
      aliasMemory = await loadTemplateAliases(tpl.id)
    } catch {
      /* ignore */
    }
    const manualPairs: AliasMemory = Array.isArray(manualMappings as unknown)
      ? ((manualMappings as Array<{ label: string; fieldKey: string }>) || []).map(m => ({
          label: normalizeLabelShared(m.label),
          fieldKey: m.fieldKey,
          source: 'manual',
          confidence: 1.0,
        }))
      : []
    const mergedAliases: AliasMemory = [...aliasMemory]
    for (const m of manualPairs) {
      const exists = mergedAliases.find(a => a.label === m.label)
      if (exists) {
        exists.fieldKey = m.fieldKey
        exists.source = 'manual'
        exists.confidence = 1.0
      } else {
        mergedAliases.push(m)
      }
    }
    const mapped = mapAttributesToTemplate(
      tplFields,
      {
        attributes: attributesRaw,
        core: {
          sku: base.sku || null,
          price: base.price ?? null,
          title: base.title || null,
          availability: base.availability || null,
        },
      },
      mergedAliases,
    )

    const next: PreviewItem = {
      ...base,
      options: {
        o1: mapped.axes.o1 || base.options?.o1 || null,
        o2: mapped.axes.o2 || base.options?.o2 || null,
        o3: mapped.axes.o3 || base.options?.o3 || null,
      },
      fieldValues: Object.keys(mapped.fieldValues).length ? mapped.fieldValues : base.fieldValues,
      unmatched: mapped.unmatched,
      diagnostics: {
        ...base.diagnostics,
        mappedKeys: Object.keys(mapped.mappedFrom).length ? mapped.mappedFrom : base.diagnostics.mappedKeys,
      },
    }

    // Required template fields missing (core common ones)
    const missing: string[] = []
    for (const f of fields) {
      if (!f.required) continue
      const keyN = normalizeLabel(f.key)
      if (keyN.endsWith('primary_variant_sku') && !next.sku) missing.push(f.key)
      if (keyN.endsWith('primary_variant_price') && next.price == null) missing.push(f.key)
    }
    if (missing.length)
      next.diagnostics.missing = Array.from(new Set([...(next.diagnostics.missing || []), ...missing]))
    return next
  }

  async function runTableGrid(url: string, scraperId: Scraper['id'], variantTemplateId?: string) {
    const page = await fetchPage({ url, snapshotMaxLength: 250_000 })
    if (page.disallowed) {
      errors.push({ url, message: 'Blocked by robots.txt' })
      return [] as PreviewItem[]
    }
    const html = page.html
    const tableMatch = html.match(/<table[^>]*class=["'][^"']*attribute-grid[^"']*["'][\s\S]*?<\/table>/i)
    if (!tableMatch) {
      errors.push({ url, message: 'table-grid-v1: table.attribute-grid not found' })
      return [] as PreviewItem[]
    }
    const tableHtml = tableMatch[0]
    const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i)
    const body = tbodyMatch ? tbodyMatch[0] : tableHtml
    const rowRe = /<tr[\s\S]*?<\/tr>/gi
    const itemsOut: PreviewItem[] = []
    let rm: RegExpExecArray | null
    while ((rm = rowRe.exec(body))) {
      const row = rm[0]
      const cells = Array.from(row.matchAll(/<td[\s\S]*?<\/td>/gi)).map(m => m[0])
      const td = (n: number) => cells[n - 1] || ''
      const textOnly = (frag: string) =>
        frag
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim()

      const code = textOnly(td(1)) || ''
      const model = textOnly(td(2)) || ''
      const infoTd = td(3)
      const attributes: Record<string, string | string[]> = {}
      // <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 (collect-raw-kv) -->
      const rawAttributes: Record<string, string> = {}
      // <!-- END RBP GENERATED: label-driven-mapping-v1-0 (collect-raw-kv) -->
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let lm: RegExpExecArray | null
      while ((lm = liRe.exec(infoTd))) {
        const li = lm[1]
        const txt = textOnly(li)
        const idx = txt.indexOf(':')
        if (idx > 0) {
          // Preserve raw label->value for label-driven matcher
          // <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 (save-raw-kv) -->
          const rawKey = txt.slice(0, idx).trim()
          const rawVal = txt.slice(idx + 1).trim()
          if (rawKey) rawAttributes[rawKey] = rawVal
          // <!-- END RBP GENERATED: label-driven-mapping-v1-0 (save-raw-kv) -->
          pushAttr(attributes, rawKey, rawVal)
        }
      }

      const availMatch = row.match(/<td[^>]*>([\s\S]*?(In Stock|Out of Stock|Backorder|Unavailable)[\s\S]*?)<\/td>/i)
      const availability = availMatch ? textOnly(availMatch[1]) : null

      const qtySection =
        row.match(/<div[^>]*class=["'][^"']*ejs-addtocart-section[^"']*["'][^>]*[\s\S]*?<\/div>/i)?.[0] || ''
      const externalId = qtySection.match(/data-productid=["']([^"']+)["']/i)?.[1] || null
      const dataProductCode = qtySection.match(/data-productcode=["']([^"']+)["']/i)?.[1] || null

      let priceCell = row.match(
        /<td[\s\S]*?<strong[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/strong>[\s\S]*?<\/td>/i,
      )
      if (!priceCell) {
        // Fallback: any element with class *price*
        priceCell = row.match(
          /<(?:strong|span|div)[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/(?:strong|span|div)>/i,
        )
      }
      let priceText = priceCell ? textOnly(priceCell[1]) : null
      // Normalize common decorations like currency codes and per-unit suffixes
      if (priceText)
        priceText = priceText
          .replace(/\bUSD\b/gi, '')
          .replace(/\/(?:Each|ea)\b/gi, '')
          .trim()
      const price = priceText ? normPrice(priceText) : null
      let currency: string | null = null
      if (priceText) {
        const m = priceText.match(/([A-Z]{3})/)
        if (m) currency = m[1]
        else if (/\$/.test(priceText)) currency = 'USD'
      }
      const msrpMatch = row.match(/<small[^>]*class=["'][^"']*muted[^"']*["'][^>]*>([\s\S]*?)<\/small>/i)
      const msrp = msrpMatch ? normPrice(textOnly(msrpMatch[1])) : null

      const sku = (code || dataProductCode || '').trim() || null
      const title = model || sku || null

      let item = buildItem(
        {
          url,
          title,
          sku,
          price,
          currency,
          msrp,
          availability,
          options: { o1: null, o2: null, o3: null },
          images: [],
          attributes,
          externalId,
          raw: { domSample: clampLen(row) },
        },
        {
          title: title ? 'dom' : 'none',
          sku: sku ? 'dom' : 'none',
          price: price != null ? 'dom' : 'none',
          currency: currency ? 'dom' : 'none',
          images: 'none',
          options: 'none',
        },
        scraperId,
      )
      item = await applyTemplateMapping(variantTemplateId, item)
      item = evaluateTemplateV2Fields(item)
      // <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 (apply-matcher) -->
      try {
        const useLabelDriven =
          typeof matchTemplateFieldsFromKV === 'function' &&
          Array.isArray(BatsonBlanksTemplateFields) &&
          BatsonBlanksTemplateFields.length > 0
        if (useLabelDriven) {
          const lr = matchTemplateFieldsFromKV(BatsonBlanksTemplateFields, rawAttributes)
          // Merge mapped values into fieldValues using template keys
          const lrVals: Record<string, string | number | null> = {}
          const mappedKeysDiag: Record<string, string> = {}
          for (const m of lr.mapped) {
            const val =
              typeof m.value === 'number' || typeof m.value === 'string'
                ? (m.value as string | number)
                : m.rawValue || null
            lrVals[m.key] = val as string | number | null
            mappedKeysDiag[m.key] = m.sourceLabel
          }
          const prevVals = item.fieldValues || {}
          item.fieldValues = { ...prevVals, ...lrVals }
          // Convert sourceUnused to unmatched label list with samples
          const lrUnmatched = lr.sourceUnused.map(s => ({ label: s.label, sample: s.value }))
          item.unmatched = Array.isArray(item.unmatched) && item.unmatched.length ? item.unmatched : lrUnmatched
          item.diagnostics.mappedKeys = { ...(item.diagnostics.mappedKeys || {}), ...mappedKeysDiag }
        }
      } catch {
        // non-fatal
      }
      // <!-- END RBP GENERATED: label-driven-mapping-v1-0 (apply-matcher) -->
      itemsOut.push(item)
    }
    if (!itemsOut.length) errors.push({ url, message: 'table-grid-v1: no rows parsed' })
    return itemsOut
  }

  async function runListFollow(url: string, scraperId: Scraper['id']) {
    const page = await fetchPage({ url, snapshotMaxLength: 250_000 })
    if (page.disallowed) {
      errors.push({ url, message: 'Blocked by robots.txt' })
      return [] as PreviewItem[]
    }
    const links = parseListLinks(page.html, url).slice(0, 30)
    const out: PreviewItem[] = []
    for (const link of links) {
      // Prefer jsonld on detail; strategy remains list-page-follow-v1 for diagnostics
      const detail = await runJsonLd(link, scraperId)
      if (detail.length) out.push(...detail)
      else out.push(...(await runDom(link, scraperId)))
    }
    // If no detail links were found, try to emit the current page as a product (some suppliers embed multiple variants on a single URL)
    if (!out.length) out.push(...(await runJsonLd(url, 'jsonld-basic')))
    return out
  }

  for (const u of urlsForPreview) {
    try {
      if (scraper.id === 'jsonld-basic') {
        items.push(...(await runJsonLd(u, scraper.id)))
      } else if (scraper.id === 'list-page-follow-v1') {
        items.push(...(await runListFollow(u, scraper.id)))
      } else if (scraper.id === 'dom-selectors-v1') {
        items.push(...(await runDom(u, scraper.id)))
      } else if (scraper.id === 'table-grid-v1') {
        items.push(...(await runTableGrid(u, scraper.id, variantTemplateId)))
      } else {
        items.push(
          buildItem(
            { url: u, title: null, sku: null, price: null, options: { o1: null, o2: null, o3: null } },
            {},
            scraper.id,
          ),
        )
      }
    } catch (e) {
      errors.push({ url: u, message: (e as Error).message })
    }
  }

  let templateFields = templateV2?.fields?.map(f => ({ id: f.id, label: f.label, required: !!f.required }))
  if ((!templateFields || !templateFields.length) && variantTemplateId) {
    try {
      const tpl = await getTemplateWithFields(variantTemplateId)
      if (tpl?.fields?.length) {
        templateFields = tpl.fields.map(f => ({ id: f.key, label: f.label, required: !!f.required }))
      }
    } catch {
      /* ignore */
    }
  }
  // Optionally persist alias memory if requested (rememberAliases + manualMappings)
  const runId = typeof runIdRaw === 'string' ? runIdRaw : ''
  if (rememberAliases && variantTemplateId && Array.isArray(manualMappings) && manualMappings.length) {
    for (const m of manualMappings) {
      if (m && m.label && m.fieldKey) {
        await rememberTemplateAlias(variantTemplateId, normalizeLabelShared(m.label), m.fieldKey, 'manual', 1.0)
      }
    }
  }

  // If runId provided, persist a mapping snapshot shell (aliases only) to prepare for Review consistency
  if (runId && variantTemplateId) {
    const aliasMem = await loadTemplateAliases(variantTemplateId).catch(() => [] as AliasMemory)
    await saveRunMappingSnapshot({
      runId,
      templateId: variantTemplateId,
      scraperId: scraper.id,
      aliases: aliasMem,
      axes: { o1: undefined, o2: undefined, o3: undefined },
    }).catch(() => null)
  }

  // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
  // Build mappingPreview from the first parsed item to show template-field coverage
  const products = items.map(it => ({
    title: it.title,
    price: it.price ?? null,
    status: it.availability || it.status || null,
    url: it.url,
  }))
  const first = items[0]
  const mappingPreview = (() => {
    if (!first) return [] as Array<{ field: string; value?: string | number | null; matchedBy?: string | null }>
    const pairs: Array<{ field: string; value?: string | number | null; matchedBy?: string | null }> = []
    const vals = first.fieldValues || {}
    const mapped = first.diagnostics?.mappedKeys || {}
    for (const k of Object.keys(vals)) {
      const v = (vals as Record<string, string | number | null | undefined>)[k]
      const m = (mapped as Record<string, string | undefined>)[k]
      pairs.push({ field: k, value: v, matchedBy: m || null })
      if (pairs.length >= 20) break
    }
    return pairs
  })()
  const meta = { templateId: variantTemplateId || null, urlUsed: urlsForPreview[0] }
  return json({ items, errors, templateFields, products, mappingPreview, meta })
  // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
}

export default function ImporterPreviewApi() {
  return null
}
