import { getDiscoverSiteById, getSiteConfigForUrlDiscoverV1 } from '../../app/server/importer/sites'
import { renderHeadlessHtml } from '../../app/server/headless/renderHeadlessHtml'
import { upsertProductSource } from '../../packages/importer/src/seeds/sources'
import * as cheerio from 'cheerio'
import { extractBatsonAttributeGrid } from '../../app/server/importer/preview/parsers/batsonAttributeGrid'

async function main() {
  const siteId = (process.env.SITE_ID || 'batson-reel-seats').trim()
  const sourceUrl = (process.env.SOURCE_URL || 'https://batsonenterprises.com/reel-seats').trim()
  const strategyEnv = (process.env.STRATEGY || 'hybrid').toLowerCase()
  const strategy: 'static' | 'headless' | 'hybrid' =
    strategyEnv === 'static' || strategyEnv === 'headless' ? (strategyEnv as 'static' | 'headless') : 'hybrid'
  const limitEnv = (process.env.LIMIT || '').trim()
  const limit = limitEnv ? Math.max(0, Number.parseInt(limitEnv, 10) || 0) : 0

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

  const baseOrigin = (() => {
    try {
      const u = new URL(sourceUrl)
      return `${u.protocol}//${u.hostname}`
    } catch {
      return 'https://batsonenterprises.com'
    }
  })()
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const slugifyCode = (code: string) =>
    code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')

  const fetchDetailWithRetry = async (url: string): Promise<string | null> => {
    const attempts: string[] = []
    attempts.push(url)
    try {
      const parsed = new URL(url)
      if (!/^www\./i.test(parsed.hostname)) {
        const clone = new URL(parsed.toString())
        clone.hostname = `www.${parsed.hostname}`
        attempts.push(clone.toString())
      }
    } catch {
      /* ignore */
    }
    for (const attemptUrl of attempts) {
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetch(attemptUrl, { method: 'GET', headers })
          if (res.ok) {
            return await res.text()
          }
          if (res.status === 404) break
          if (res.status === 429) await sleep(400 * (i + 1))
        } catch {
          /* ignore */
        }
      }
    }
    return null
  }

  const expandReelSeatSeeds = async (urlsToExpand: string[], maxSeeds: number): Promise<string[]> => {
    const expanded = new Set<string>()
    for (const detailUrl of urlsToExpand) {
      if (maxSeeds > 0 && expanded.size >= maxSeeds) break
      const html = await fetchDetailWithRetry(detailUrl)
      if (!html) {
        expanded.add(detailUrl)
        continue
      }
      const $ = cheerio.load(html)
      const canonicalHref = $('link[rel="canonical"]').attr('href')?.trim()
      let canonicalUrl: URL | null = null
      if (canonicalHref) {
        try {
          canonicalUrl = new URL(canonicalHref)
        } catch {
          canonicalUrl = null
        }
      }
      if (!canonicalUrl) {
        try {
          canonicalUrl = new URL(detailUrl)
        } catch {
          canonicalUrl = null
        }
      }

      const rows = extractBatsonAttributeGrid(html, canonicalUrl?.origin || baseOrigin) as Array<{
        raw?: Record<string, string>
      }>
      if (!rows || !rows.length || !canonicalUrl) {
        expanded.add(detailUrl)
        continue
      }
      const canonicalCode = String(rows[0]?.raw?.Code || '').trim()
      const canonicalCodeSlug = slugifyCode(canonicalCode)
      const canonicalPath = canonicalUrl.pathname.replace(/\/+/g, '/').replace(/\/$/, '')
      const basePath = (() => {
        if (canonicalCodeSlug && canonicalPath.toLowerCase().endsWith(canonicalCodeSlug)) {
          const slice = canonicalPath.slice(0, canonicalPath.length - canonicalCodeSlug.length)
          return slice.replace(/-$/, '')
        }
        return canonicalPath
      })()

      let perPageCount = 0
      for (const row of rows) {
        const code = String(row?.raw?.Code || '').trim()
        if (!code) continue
        const slug = slugifyCode(code)
        if (!slug) continue
        const variantPath = `${basePath}-${slug}`.replace(/--+/g, '-')
        const variantUrl = `${canonicalUrl.origin}${variantPath.startsWith('/') ? '' : '/'}${variantPath}?variant=${encodeURIComponent(
          code.trim().toUpperCase(),
        )}`
        expanded.add(variantUrl)
        perPageCount++
        if (maxSeeds > 0 && expanded.size >= maxSeeds) break
      }
      if (perPageCount > 0 && expanded.size < 20) {
        console.log('[expandReelSeatSeeds] expanded', detailUrl, '->', perPageCount)
      }
      if (perPageCount === 0) {
        expanded.add(detailUrl)
      }
      await sleep(200)
    }
    return Array.from(expanded)
  }

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

  const res = await siteObj.discover(fetchHtml, sourceUrl || baseOrigin)
  const urls = Array.from(
    new Set((Array.isArray(res.seeds) ? res.seeds.map((s: { url: string }) => s.url) : []) as string[]),
  )
  const baseForExpansion = limit > 0 ? urls.slice(0, limit) : urls
  const expandedUrls =
    siteId === 'batson-reel-seats' && baseForExpansion.length
      ? await expandReelSeatSeeds(baseForExpansion, limit)
      : baseForExpansion
  const finalUrls = Array.from(new Set(expandedUrls))
  const limitedUrls = limit > 0 ? finalUrls.slice(0, limit) : finalUrls

  // Persist seeds best-effort under supplierId=siteId
  let persisted = 0
  for (const u of limitedUrls) {
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
    totalFound: typeof dbgRes?.totalFound === 'number' ? dbgRes.totalFound : finalUrls.length,
    deduped: typeof dbgRes?.deduped === 'number' ? dbgRes.deduped : finalUrls.length,
    limited: limit > 0 ? limitedUrls.length : undefined,
    sample: limitedUrls.slice(0, 8),
    contentLength: (staticHtml || headlessHtml || '').length,
    textLength: (staticHtml || headlessHtml || '').replace(/<[^>]+>/g, '').length,
  }

  console.log(
    JSON.stringify(
      { ok: true, siteId, urlsCount: finalUrls.length, persisted, limitApplied: limit > 0 ? limit : undefined, debug },
      null,
      2,
    ),
  )
}

main().catch(err => {
  console.error('[discoverAndSeed] fatal', err)
  process.exitCode = 1
})
