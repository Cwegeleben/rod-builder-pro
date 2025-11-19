import { getDiscoverSiteById, getSiteConfigForUrlDiscoverV1 } from '../../app/server/importer/sites'
import { renderHeadlessHtml } from '../../app/server/headless/renderHeadlessHtml'
import { upsertProductSource } from '../../packages/importer/src/seeds/sources'

async function main() {
  const siteId = (process.env.SITE_ID || 'batson-reel-seats').trim()
  const sourceUrl = (process.env.SOURCE_URL || 'https://batsonenterprises.com/reel-seats').trim()
  const strategyEnv = (process.env.STRATEGY || 'hybrid').toLowerCase()
  const strategy: 'static' | 'headless' | 'hybrid' =
    strategyEnv === 'static' || strategyEnv === 'headless' ? (strategyEnv as 'static' | 'headless') : 'hybrid'

  if (!sourceUrl) {
    console.log(JSON.stringify({ ok: false, error: 'SOURCE_URL missing' }))
    return
  }

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }

  const baseUrl = (() => {
    try {
      const u = new URL(sourceUrl)
      return `${u.protocol}//${u.hostname}`
    } catch {
      return 'https://batsonenterprises.com'
    }
  })()

  // Prefer the more reliable static fetch used by discover-site.ts
  type StaticRes = { status: number; contentLength: number; html: string }
  const fetchStaticHtml = async (url: string): Promise<StaticRes> => {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers })
      const buf = await res.arrayBuffer()
      const html = new TextDecoder('utf-8').decode(buf)
      return { status: res.status, contentLength: buf.byteLength, html }
    } catch {
      return { status: 0, contentLength: 0, html: '' }
    }
  }

  const staticRes = await fetchStaticHtml(sourceUrl)
  const staticHtml: string | null = staticRes.html || null
  let headlessHtml: string | null = null
  const fetchHtml = async (mode: 'static' | 'headless'): Promise<string | null> => {
    if (mode === 'static') {
      return staticHtml
    } else {
      if (headlessHtml != null) return headlessHtml
      try {
        const t = await renderHeadlessHtml(sourceUrl, {
          waitUntil: 'networkidle',
          afterNavigateDelayMs: 400,
          autoScroll: true,
          timeoutMs: 20_000,
        })
        headlessHtml = t
        return t
      } catch {
        return null
      }
    }
  }

  const siteObj = (siteId ? getDiscoverSiteById(siteId) : null) || getSiteConfigForUrlDiscoverV1(sourceUrl)
  if (!siteObj || typeof siteObj.discover !== 'function') {
    console.log(JSON.stringify({ ok: false, siteId, error: 'No site discoverer' }))
    return
  }

  let usedMode: 'static' | 'headless' | 'none' = staticHtml && staticHtml.trim() ? 'static' : 'none'
  if (strategy === 'headless' && usedMode === 'none') {
    const h = await fetchHtml('headless')
    usedMode = h ? 'headless' : usedMode
  } else if (strategy === 'hybrid' && usedMode === 'none') {
    const h = await fetchHtml('headless')
    usedMode = h ? 'headless' : 'none'
  }

  const res = await siteObj.discover(fetchHtml, baseUrl)
  const urls = Array.from(
    new Set((Array.isArray(res.seeds) ? res.seeds.map((s: { url: string }) => s.url) : []) as string[]),
  )

  // Persist seeds best-effort under supplierId=siteId
  let persisted = 0
  for (const u of urls) {
    try {
      await upsertProductSource(siteId, u, 'discovered', 'discover:category', undefined)
      persisted++
    } catch {
      /* ignore individual seed failure */
    }
  }

  const dbgRes = res?.debug as unknown as {
    strategyUsed?: string
    totalFound?: number
    deduped?: number
  }
  const debug = {
    siteId: siteObj.id || siteId,
    usedMode: res.usedMode || usedMode,
    strategyUsed: dbgRes?.strategyUsed || 'n/a',
    totalFound: typeof dbgRes?.totalFound === 'number' ? dbgRes.totalFound : urls.length,
    deduped: typeof dbgRes?.deduped === 'number' ? dbgRes.deduped : urls.length,
    sample: urls.slice(0, 8),
    contentLength: (staticHtml || headlessHtml || '').length,
    textLength: (staticHtml || headlessHtml || '').replace(/<[^>]+>/g, '').length,
  }

  console.log(JSON.stringify({ ok: true, siteId, urlsCount: urls.length, persisted, debug }, null, 2))
}

main().catch(err => {
  console.error('[discoverAndSeed] fatal', err)
  process.exitCode = 1
})
