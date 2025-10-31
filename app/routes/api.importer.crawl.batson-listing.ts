import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { crawlBatsonRodBlanksListing } from '../server/importer/crawlers/batsonListing'
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const base = 'https://batsonenterprises.com'
  const canonicalPath = '/rod-blanks'
  const canonical = `${base}${canonicalPath}`

  type CrawlBody = { startUrl?: string; devSampleHtml?: boolean }
  const raw = (await request.json().catch(() => ({}))) as unknown
  const body: CrawlBody = raw && typeof raw === 'object' ? (raw as CrawlBody) : {}
  const inputStartUrl = typeof body.startUrl === 'string' ? body.startUrl : undefined
  const wantSample = typeof body.devSampleHtml === 'boolean' ? body.devSampleHtml : false

  let url = canonical
  if (typeof inputStartUrl === 'string' && inputStartUrl.trim()) {
    try {
      const u = new URL(inputStartUrl)
      if (u.hostname !== 'batsonenterprises.com' || !u.pathname.startsWith(canonicalPath)) {
        return json(
          { urls: [], count: 0, debug: { reason: 'Off-canonical startUrl. Use /rod-blanks', got: inputStartUrl } },
          { status: 400 },
        )
      }
      url = u.toString()
    } catch {
      return json(
        { urls: [], count: 0, debug: { reason: 'Invalid startUrl format', got: inputStartUrl } },
        { status: 400 },
      )
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

  const withTimeout = async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      return await fetch(url, { method: 'GET', headers, signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  let res: Response
  try {
    res = await withTimeout()
  } catch (e: unknown) {
    return json(
      {
        urls: [],
        count: 0,
        debug: { reason: `Network error: ${String(e instanceof Error ? e.message : e)}`, startUrl: url },
      },
      { status: 502 },
    )
  }

  const status = res.status
  const contentType = res.headers.get('content-type') || ''
  const contentLength = res.headers.get('content-length') || ''
  if (!res.ok) {
    return json(
      { urls: [], count: 0, debug: { reason: `Upstream ${status}`, contentType, contentLength, startUrl: url } },
      { status: 502 },
    )
  }

  const html = await res.text()
  const urls = crawlBatsonRodBlanksListing(html, base)

  const payload: { urls: string[]; count: number; debug?: Record<string, unknown> } = { urls, count: urls.length }
  let debug: Record<string, unknown> | undefined
  if (urls.length === 0) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const pageTitle = m ? m[1].trim() : undefined
    debug = { reason: 'Parsed zero series links', status, contentType, contentLength, pageTitle, startUrl: url }
  }
  if (wantSample) {
    if (urls.length > 0) {
      debug = { ...(debug || {}), sampleCount: urls.length, startUrl: url, htmlExcerpt: html.slice(0, 2048) }
    } else {
      debug = { ...(debug || {}), htmlExcerpt: html.slice(0, 4096) }
    }
  }
  if (debug) payload.debug = debug

  return json(payload)
}

export default function ApiImporterCrawlBatsonListing() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
