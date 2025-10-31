// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

type Req = {
  sourceUrl?: string
  discoveryModel?: 'batson-listing' | 'sitemap' | 'grid' | 'regex'
  headless?: boolean
}

// (no-op)

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const ct = request.headers.get('content-type') || ''
  const unsafe = /json/i.test(ct) ? ((await request.json().catch(() => ({}))) as unknown) : {}
  const body: Req = typeof unsafe === 'object' && unsafe ? (unsafe as Req) : {}
  const sourceUrl = String(body?.sourceUrl || '').trim()
  // Resolve site config (model + headless) based on sourceUrl
  const { getSiteConfigForUrl } = await import('../server/importer/sites')
  const siteCfg = getSiteConfigForUrl(sourceUrl)
  const discoveryModel = siteCfg.discovery.model
  const useHeadless = !!siteCfg.discovery.headless
  if (!sourceUrl) return json({ error: 'sourceUrl required' }, { status: 400 })

  // Static fetch first; headless fallback is not enabled on server runtime (documented)
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
  let status = 0
  let contentType: string | undefined
  let usedStrategy: 'static' | 'headless' = 'static'
  const usedModel: NonNullable<Req['discoveryModel']> = discoveryModel
  const headless: { attempted: boolean; available?: boolean; error?: string; title?: string; length?: number } = {
    attempted: false,
  }
  // Scope: per user requirement, discovery must parse ONLY the provided sourceUrl HTML (no external fetches)
  try {
    const r = await fetch(sourceUrl, { headers, signal: ctrl.signal })
    status = r.status
    contentType = r.headers.get('content-type') || undefined
    if (!r.ok) return json({ urls: [], count: 0, debug: { sourceUrl, status, contentType } })
    html = await r.text()
  } finally {
    clearTimeout(timer)
  }

  const urlObj = new URL(sourceUrl)
  const base = `${urlObj.protocol}//${urlObj.host}`
  let urls: string[] = []

  // <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
  // Prefer file-driven site discoverer when available (ADD-only; non-breaking)
  try {
    const { getSiteConfigForUrlDiscoverV1 } = await import('../server/importer/sites')
    const site = getSiteConfigForUrlDiscoverV1?.(sourceUrl) as {
      id: string
      discover?: (f: (m: 'static' | 'headless') => Promise<string | null>, b: string) => Promise<unknown>
    } | null
    if (site && typeof site.discover === 'function') {
      const fetchHtml = async (mode: 'static' | 'headless'): Promise<string | null> => {
        if (mode === 'static') return html || ''
        const rendered = await tryHeadlessRender()
        return rendered || null
      }
      const result = await site.discover(fetchHtml, base)
      const r = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
      const seedsVal = Array.isArray(r.seeds) ? (r.seeds as Array<Record<string, unknown>>) : []
      const list = seedsVal
        .map(s => {
          const u = typeof s.url === 'string' ? s.url : ''
          return u.trim()
        })
        .filter(Boolean)
      const usedMode = typeof r.usedMode === 'string' ? (r.usedMode as string) : 'static'
      const dbg = r.debug && typeof r.debug === 'object' ? (r.debug as Record<string, unknown>) : {}
      const pt = (() => {
        const m = (html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        return m ? m[1].trim() : undefined
      })()
      return json({
        urls: list,
        count: list.length,
        debug: {
          startUrl: sourceUrl,
          siteId: site.id,
          usedMode,
          usedModel,
          strategy: useHeadless ? 'hybrid' : 'static',
          pageTitle: pt,
          contentType,
          contentLength: String((html || '').length),
          ...dbg,
        },
      })
    }
  } catch {
    /* ignore and fall back to generic flow */
  }
  // <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->

  async function tryHeadlessRender(): Promise<string | null> {
    headless.attempted = true
    try {
      const mod = await import('playwright')
      const browser = await mod.chromium.launch({ headless: true })
      try {
        const page = await browser.newPage({ userAgent: headers['User-Agent'] })
        await page.goto(sourceUrl, { timeout: 12000, waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1200)
        const content = await page.content()
        const t = await page.title().catch(() => '')
        headless.available = true
        headless.title = t || undefined
        headless.length = content.length
        return content
      } finally {
        await browser.close().catch(() => {})
      }
    } catch (e) {
      headless.available = false
      headless.error = (e as Error)?.message || 'headless unavailable'
      return null
    }
  }

  // Run selected discovery model against fetched HTML (source-only)
  try {
    const { runDiscovery } = await import('../server/importer/discovery')
    urls = await runDiscovery(discoveryModel, html, base, sourceUrl)
    if (!urls.length && useHeadless) {
      const rendered = await tryHeadlessRender()
      if (rendered) {
        usedStrategy = 'headless'
        urls = await runDiscovery(discoveryModel, rendered, base, sourceUrl)
        html = rendered
      }
    }
  } catch {
    urls = []
  }

  // If still empty and non-static strategy requested, signal that headless is not enabled
  // Enrich diagnostics
  const pageTitle = (() => {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    return m ? m[1].trim() : undefined
  })()
  const debug: Record<string, unknown> = {
    startUrl: sourceUrl,
    got: sourceUrl,
    status,
    contentType,
    strategy: useHeadless ? 'hybrid' : 'static',
    siteId: siteCfg.id,
    usedModel,
    usedStrategy,
    pageTitle,
    contentLength: String(html.length),
    note: 'scope: source-only',
    htmlExcerpt: html.slice(0, 4096),
    headless,
  }

  return json({ urls, count: urls.length, debug })
}

export default function ImporterDiscoverApi() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
