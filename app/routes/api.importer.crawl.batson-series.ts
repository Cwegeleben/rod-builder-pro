import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { discoverBatsonSeriesAllPages } from '../server/importer/crawlers/batsonSeries'
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const base = 'https://batsonenterprises.com'
  const canonicalPath = '/blanks-by-series'
  const canonical = `${base}${canonicalPath}`

  // Parse JSON body if provided; tolerate non-JSON
  type CrawlBody = { startUrl?: string; devSampleHtml?: boolean; maxPages?: number }
  const raw = (await request.json().catch(() => ({}))) as unknown
  const body: CrawlBody = raw && typeof raw === 'object' ? (raw as CrawlBody) : {}
  const inputStartUrl = typeof body.startUrl === 'string' ? body.startUrl : undefined
  const wantSample = typeof body.devSampleHtml === 'boolean' ? body.devSampleHtml : false
  const maxPages = typeof body.maxPages === 'number' ? body.maxPages : undefined

  // Guardrail: require batson host + canonical path
  let url = canonical
  if (typeof inputStartUrl === 'string' && inputStartUrl.trim()) {
    try {
      const u = new URL(inputStartUrl)
      if (u.hostname !== 'batsonenterprises.com' || !u.pathname.startsWith(canonicalPath)) {
        return json(
          {
            urls: [],
            count: 0,
            debug: { reason: 'Off-canonical startUrl. Use /blanks-by-series', got: inputStartUrl },
          },
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

  try {
    const res = await discoverBatsonSeriesAllPages(url, { maxPages })
    const payload: { urls: string[]; count: number; debug?: Record<string, unknown> } = {
      urls: res.urls,
      count: res.urls.length,
      debug: {
        pagesVisited: res.debug.pagesVisited,
        nextVia: { rel: res.debug.fromRelNext, heuristic: res.debug.fromHeuristic },
      },
    }
    // Optional, append sample info if requested
    if (wantSample) payload.debug = { ...(payload.debug || {}), sampleCount: res.urls.length, startUrl: url }
    return json(payload)
  } catch (e) {
    return json({ urls: [], count: 0, debug: { reason: (e as Error)?.message || String(e) } }, { status: 400 })
  }
}

export default function ApiImporterCrawlBatsonSeries() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
