// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
/**
 * Generic discovery preflight runner
 * Usage examples:
 *   SITE_ID=batson-rod-blanks SOURCE_URL=https://batsonenterprises.com/rod-blanks pnpm -s tsx scripts/preflight/discover-site.ts
 *   SITE_ID=batson-reel-seats SOURCE_URL=https://batsonenterprises.com/reel-seats pnpm -s tsx scripts/preflight/discover-site.ts
 *   SITE_ID=batson-guides-tops SOURCE_URL=https://batsonenterprises.com/guides-tip-tops pnpm -s tsx scripts/preflight/discover-site.ts
 */
import { renderHeadlessHtml } from '../../app/server/headless/renderHeadlessHtml'
import { getSiteConfigForUrlDiscoverV1, getDiscoverSiteById } from '../../app/server/importer/sites'
import type { DiscoverResult } from '../../app/server/importer/discovery/batsonListing'
import { crawlBatsonRodBlanksListing } from '../../app/server/importer/discovery/batsonListing'

type StaticRes = { status: number; contentLength: number; html: string }
async function fetchStaticHtml(url: string): Promise<StaticRes> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
  } as const
  const res = await fetch(url, { method: 'GET', redirect: 'follow', headers })
  const buf = await res.arrayBuffer()
  const html = new TextDecoder('utf-8').decode(buf)
  return { status: res.status, contentLength: buf.byteLength, html }
}

async function main() {
  const SITE_ID = process.env.SITE_ID || ''
  const SOURCE_URL = process.env.SOURCE_URL || ''
  if (!SOURCE_URL) {
    console.error('Missing SOURCE_URL')
    process.exit(2)
  }

  const site = SITE_ID ? getDiscoverSiteById(SITE_ID) : getSiteConfigForUrlDiscoverV1(SOURCE_URL)
  const siteId = (site?.id ?? SITE_ID) || 'unknown'

  type HeadlessDbg = { available: boolean; attempted: boolean; error?: string }
  type PreflightDebug = {
    siteId: string
    status: number | null
    contentLength: number
    pageTitle?: string
    textLength?: number
    htmlExcerpt?: string
    headless?: HeadlessDbg
    strategyUsed?: string
    notes: string[]
  }
  const dbg: PreflightDebug = { siteId, notes: [], status: null, contentLength: 0 }

  let s: StaticRes
  try {
    s = await fetchStaticHtml(SOURCE_URL)
  } catch {
    s = { status: 0, contentLength: 0, html: '' }
  }
  dbg.status = s.status
  dbg.contentLength = s.contentLength

  let htmlToParse: string | null = s.html || null
  let usedMode: 'static' | 'headless' | 'none' = 'none'

  if (htmlToParse && htmlToParse.trim().length > 500) {
    usedMode = 'static'
  } else {
    const headlessAvailable = Boolean(process.env.PLAYWRIGHT_AVAILABLE)
    dbg.headless = { available: headlessAvailable, attempted: false }
    if (headlessAvailable) {
      dbg.headless.attempted = true
      try {
        const h = await renderHeadlessHtml(SOURCE_URL, {
          waitUntil: 'networkidle',
          afterNavigateDelayMs: 400,
          autoScroll: true,
          timeoutMs: 15000,
        })
        if (h && h.trim().length > 0) {
          htmlToParse = h
          usedMode = 'headless'
          dbg.contentLength = h.length
        }
      } catch (e) {
        dbg.headless.error = (e as Error).message || String(e)
      }
    }
    if (usedMode === 'none') usedMode = htmlToParse ? 'static' : 'none'
  }

  if (htmlToParse) {
    const m = htmlToParse.match(/<title[^>]*>([^<]*)<\/title>/i)
    dbg.pageTitle = m?.[1]?.trim() || 'n/a'
    const stripped = htmlToParse
      .replace(/\s+/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .trim()
    dbg.textLength = stripped.length
    dbg.htmlExcerpt = stripped.slice(0, 600)
  } else {
    dbg.pageTitle = 'n/a'
    dbg.textLength = 0
    dbg.htmlExcerpt = '(no excerpt)'
  }

  let urls: string[] = []
  type SiteLike = {
    id: string
    discover?: (
      fetchHtml: (mode: 'static' | 'headless') => Promise<string | null>,
      baseUrl: string,
    ) => Promise<DiscoverResult & { usedMode?: 'static' | 'headless' | 'none' }>
  }
  if (site && (site as SiteLike).discover) {
    const discover = (site as SiteLike).discover
    const res = await discover!(async (mode: 'static' | 'headless') => {
      if (mode === 'static') return s.html ?? null
      if (!dbg.headless?.available) return null
      return renderHeadlessHtml(SOURCE_URL, {
        waitUntil: 'networkidle',
        afterNavigateDelayMs: 400,
        autoScroll: true,
        timeoutMs: 15000,
      })
    }, SOURCE_URL)
    urls = (res?.seeds || []).map(s => s.url).filter(Boolean)
    dbg.strategyUsed = res?.debug?.strategyUsed || dbg.strategyUsed
    dbg.notes = [...(res?.debug?.notes || []), ...(dbg.notes || [])]
  } else if (siteId === 'batson-rod-blanks' && htmlToParse) {
    const r = crawlBatsonRodBlanksListing(htmlToParse, new URL(SOURCE_URL).origin)
    urls = r.seeds.map(s => s.url)
    dbg.strategyUsed = r.debug?.strategyUsed ?? 'grid'
  } else {
    dbg.notes.push('No site.discover; returning empty seed list.')
  }

  console.log(JSON.stringify({ usedMode, urlsSample: urls.slice(0, 8), total: urls.length, debug: dbg }, null, 2))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
// <!-- END RBP GENERATED: importer-discover-unified-v1 -->
