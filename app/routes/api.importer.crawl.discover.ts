// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

type Req = {
  sourceUrl?: string
  discoveryModel?: 'batson-listing' | 'sitemap' | 'grid' | 'regex'
  headless?: boolean
  // <!-- BEGIN RBP GENERATED: importer-known-targets-v1 -->
  siteId?: string
  // <!-- END RBP GENERATED: importer-known-targets-v1 -->
}

// (no-op)

// <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
// Enhanced static fetch with realistic headers + simple retry/backoff
async function fetchStaticHtmlWithHeaders(
  url: string,
  tries = 2,
): Promise<{ html: string | null; info: { status?: number; contentLength?: number } }> {
  const info: { status?: number; contentLength?: number } = {}
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  } as const
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers }).catch(() => null)
    if (!res) continue
    info.status = res.status
    const buf = await res.arrayBuffer()
    info.contentLength = buf.byteLength
    const html = new TextDecoder('utf-8').decode(buf)
    if (res.ok && html && html.trim().length > 0) return { html, info }
    if (res.status >= 500 || res.status === 429) await new Promise(r => setTimeout(r, 500 * (i + 1)))
  }
  return { html: null, info }
}
// <!-- END RBP GENERATED: importer-discover-hardening-v1 -->

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const ct = request.headers.get('content-type') || ''
  const unsafe = /json/i.test(ct) ? ((await request.json().catch(() => ({}))) as unknown) : {}
  const body: Req = typeof unsafe === 'object' && unsafe ? (unsafe as Req) : {}
  const sourceUrl = String(body?.sourceUrl || '').trim()
  // <!-- BEGIN RBP GENERATED: importer-known-targets-v1 -->
  const siteId = String(body?.siteId || '').trim()
  // <!-- END RBP GENERATED: importer-known-targets-v1 -->
  // Resolve site config (model + headless) based on sourceUrl
  const { getSiteConfigForUrl } = await import('../server/importer/sites')
  const siteCfg = getSiteConfigForUrl(sourceUrl)
  const discoveryModel = siteCfg.discovery.model
  const useHeadless = !!siteCfg.discovery.headless
  if (!sourceUrl) return json({ error: 'sourceUrl required' }, { status: 400 })

  // <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
  // Hardened fetch + diagnostics
  const diag: Record<string, unknown> = { notes: [] }
  let html = ''
  let status = 0
  let contentType: string | undefined
  let usedMode: 'static' | 'headless' | 'none' = 'none'
  const usedModel: NonNullable<Req['discoveryModel']> = discoveryModel
  const headless: { attempted: boolean; available?: boolean; error?: string; title?: string; length?: number } = {
    attempted: false,
  }

  const staticRes = await fetchStaticHtmlWithHeaders(sourceUrl)
  html = staticRes.html || ''
  status = staticRes.info.status || 0
  contentType = undefined as string | undefined
  diag.contentLength = staticRes.info.contentLength ?? 0
  usedMode = html && html.trim().length > 500 ? 'static' : 'none'
  // <!-- END RBP GENERATED: importer-discover-hardening-v1 -->

  const urlObj = new URL(sourceUrl)
  const base = `${urlObj.protocol}//${urlObj.host}`
  let urls: string[] = []

  // <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
  // Prefer file-driven site discoverer when available (ADD-only; non-breaking)
  try {
    const { getSiteConfigForUrlDiscoverV1, getDiscoverSiteById, getSiteConfigById } = await import(
      '../server/importer/sites'
    )
    // If siteId explicitly provided, prefer that site; else match by URL
    const site = (siteId ? getDiscoverSiteById(siteId) : getSiteConfigForUrlDiscoverV1?.(sourceUrl)) as {
      id: string
      discover?: (f: (m: 'static' | 'headless') => Promise<string | null>, b: string) => Promise<unknown>
    } | null
    if (site && typeof site.discover === 'function') {
      let lastHeadlessHtml: string | null = null
      const fetchHtml = async (mode: 'static' | 'headless'): Promise<string | null> => {
        if (mode === 'static') return html || ''
        const rendered = await tryHeadlessRender(sourceUrl)
        if (rendered) lastHeadlessHtml = rendered
        return rendered || null
      }
      // If explicit siteId provided, override model/headless with its config
      const cfgById = siteId ? getSiteConfigById(siteId) : null
      const usedModel = (cfgById?.discovery.model || discoveryModel) as NonNullable<Req['discoveryModel']>
      const strategy = cfgById?.discovery.headless || useHeadless ? 'hybrid' : 'static'
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
      const chosenHtml = usedMode === 'headless' ? lastHeadlessHtml || html || '' : html || ''
      const pt = (() => {
        const m = (chosenHtml || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        return m ? m[1].trim() : undefined
      })()
      const stripped = (chosenHtml || '')
        .replace(/\s+/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .trim()
      const excerpt = stripped.slice(0, 600)
      return json({
        urls: list,
        count: list.length,
        debug: {
          startUrl: sourceUrl,
          siteId: site.id,
          usedMode,
          usedModel,
          strategy,
          pageTitle: pt,
          contentType,
          contentLength: String((chosenHtml || '').length),
          textLength: stripped.length,
          htmlExcerpt: excerpt,
          headless,
          ...dbg,
        },
      })
    }
  } catch {
    /* ignore and fall back to generic flow */
  }
  // <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->

  // <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
  async function tryHeadlessRender(url: string): Promise<string | null> {
    headless.attempted = true
    try {
      const mod = await import('playwright')
      const browser = await mod.chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        await page.goto(url, { timeout: 15000, waitUntil: 'networkidle' })
        // auto-scroll to trigger lazy content
        await page.evaluate(async () => {
          await new Promise<void>(resolve => {
            let total = 0
            const step = () => {
              const dy = Math.min(400, document.body.scrollHeight - window.scrollY)
              window.scrollBy(0, dy)
              total += dy
              if (total >= document.body.scrollHeight || dy <= 0) return resolve()
              setTimeout(step, 100)
            }
            step()
          })
        })
        await page.waitForTimeout(400)
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
  // <!-- END RBP GENERATED: importer-discover-hardening-v1 -->

  // Run selected discovery model against fetched HTML (source-only)
  try {
    const { runDiscovery } = await import('../server/importer/discovery')
    urls = await runDiscovery(discoveryModel, html, base, sourceUrl)
    if (!urls.length && useHeadless) {
      const rendered = await tryHeadlessRender(sourceUrl)
      if (rendered) {
        usedMode = 'headless'
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
  const stripped = (html || '')
    .replace(/\s+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .trim()
  const excerpt = stripped.slice(0, 600)
  const debug: Record<string, unknown> = {
    startUrl: sourceUrl,
    got: sourceUrl,
    status,
    contentType,
    strategy: useHeadless ? 'hybrid' : 'static',
    siteId: siteCfg.id,
    usedModel,
    usedMode,
    pageTitle,
    contentLength: String(html.length),
    textLength: stripped.length,
    note: 'scope: source-only',
    htmlExcerpt: excerpt,
    headless,
  }

  return json({ urls, count: urls.length, debug })
}

export default function ImporterDiscoverApi() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
