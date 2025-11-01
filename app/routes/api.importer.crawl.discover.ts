import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getDiscoverSiteById, getSiteConfigForUrlDiscoverV1 } from '../server/importer/sites'
import { renderHeadlessHtml } from '../server/headless/renderHeadlessHtml'

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
      const siteId = String(fd.get('siteId') || '').trim()
      const sourceUrl = String(fd.get('sourceUrl') || '').trim()
      if (siteId) o.siteId = siteId
      if (sourceUrl) o.sourceUrl = sourceUrl
    }
    return o
  }
  const { siteId: siteIdRaw, sourceUrl: sourceUrlRaw } = (await read()) as {
    siteId?: string
    sourceUrl?: string
  }
  const siteId = (siteIdRaw || '').trim()
  const sourceUrl = (sourceUrlRaw || '').trim()
  if (!sourceUrl) return json({ urls: [], debug: { notes: ['sourceUrl missing'] } })

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
  const urls = Array.isArray(res.seeds) ? res.seeds.map((s: { url: string }) => s.url) : []
  const debug = {
    siteId: siteObj.id || siteId || 'unknown',
    usedMode: res.usedMode || 'none',
    strategyUsed: (res.debug as Record<string, unknown> | undefined)?.strategyUsed || 'n/a',
    totalFound: (res.debug as Record<string, unknown> | undefined)?.totalFound || urls.length,
    deduped: (res.debug as Record<string, unknown> | undefined)?.deduped || urls.length,
    sample: urls.slice(0, 5),
    htmlExcerpt: (staticHtml || headlessHtml || '').slice(0, 600),
    notes: ((res.debug as Record<string, unknown> | undefined)?.notes as string[] | undefined) || [],
    status: 200,
    contentLength: (staticHtml || headlessHtml || '').length,
    textLength: (staticHtml || headlessHtml || '').replace(/<[^>]+>/g, '').length,
  }
  return json({ urls, debug })
}

export default function ImporterDiscoverApi() {
  return null
}
