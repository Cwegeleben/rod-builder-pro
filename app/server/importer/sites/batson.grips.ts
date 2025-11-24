// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
import * as cheerio from 'cheerio'

export const BatsonGripsSite = {
  id: 'batson-grips',
  match(url: string) {
    try {
      const u = new URL(url)
      const path = u.pathname.replace(/\/+$/, '')
      return u.hostname.endsWith('batsonenterprises.com') && path === '/grips'
    } catch {
      return false
    }
  },
  async discover(fetchHtml: (mode: 'static' | 'headless') => Promise<string | null>, baseUrl: string) {
    const notes: string[] = []
    const baseOrigin = (() => {
      try {
        const url = new URL(baseUrl)
        return url.origin
      } catch {
        return baseUrl
      }
    })()
    const BASE_PATH_REGEX = /^\/grips(\/|$)/
    const normalizePath = (path: string) => {
      const trimmed = path.replace(/\/+$/, '')
      return trimmed || '/'
    }
    const allowedPathPrefixes = new Set<string>()
    const addAllowedPrefix = (urlStr: string) => {
      try {
        const normalized = normalizePath(new URL(urlStr).pathname)
        allowedPathPrefixes.add(normalized)
      } catch {
        /* ignore */
      }
    }
    const isAllowedPath = (path: string) => {
      const normalized = normalizePath(path)
      if (allowedPathPrefixes.size === 0) return BASE_PATH_REGEX.test(normalized)
      for (const prefix of allowedPathPrefixes) {
        if (prefix === '/') return true
        if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return true
      }
      return false
    }

    const toAbs = (href: string) => {
      try {
        const abs = /^https?:/i.test(href) ? href : `${baseOrigin}${href.startsWith('/') ? '' : '/'}${href}`
        const u = new URL(abs)
        u.hash = ''
        return u.toString()
      } catch {
        return href
      }
    }

    const hasListingMarkers = (html: string | null | undefined): boolean => {
      if (!html) return false
      return /ListingProducts/i.test(html) || /ProductsTotalCount/i.test(html)
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    type GetHtmlOpts = { expectListing?: boolean; triedAlt?: boolean }

    async function getHtml(
      url: string,
      opts?: GetHtmlOpts,
    ): Promise<{ html: string | null; mode: 'static' | 'headless' | 'none' }> {
      const expectListing = Boolean(opts?.expectListing)
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      }
      let staticHtml: string | null = null
      const maxAttempts = expectListing ? 6 : 2
      const altUrl = (() => {
        if (opts?.triedAlt) return null
        try {
          const parsed = new URL(url)
          if (/^www\./i.test(parsed.hostname)) return null
          const clone = new URL(parsed.toString())
          clone.hostname = `www.${parsed.hostname}`
          return clone.toString()
        } catch {
          return null
        }
      })()
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 12000)
        try {
          const r = await fetch(url, { headers, signal: ctrl.signal })
          if (r.ok) {
            const t = await r.text()
            clearTimeout(timer)
            if (t && t.trim()) {
              staticHtml = t
              if (!expectListing || hasListingMarkers(t)) {
                return { html: t, mode: 'static' }
              }
            }
          } else if (r.status === 429) {
            notes.push(`rate limited (429) fetching ${url}`)
            if (altUrl) {
              notes.push(`retrying via alternate host ${altUrl}`)
              await sleep(600)
              return getHtml(altUrl, { ...opts, triedAlt: true })
            }
          } else if (r.status >= 500) {
            notes.push(`server error ${r.status} fetching ${url}`)
          }
        } catch {
          /* fall back */
        } finally {
          clearTimeout(timer)
        }
        if (expectListing) await sleep(400 * (attempt + 1))
      }
      try {
        const { renderHeadlessHtml } = await import('../../headless/renderHeadlessHtml')
        const t = await renderHeadlessHtml(url, { timeoutMs: 20000, autoScroll: true })
        if (t && t.trim()) {
          if (expectListing && staticHtml && !hasListingMarkers(staticHtml) && !hasListingMarkers(t)) {
            return { html: staticHtml, mode: 'static' }
          }
          if (expectListing && staticHtml && !hasListingMarkers(staticHtml) && hasListingMarkers(t)) {
            notes.push('static fetch lacked listing markers; fell back to headless')
          }
          return { html: t, mode: 'headless' }
        }
        return { html: staticHtml, mode: staticHtml ? 'static' : 'none' }
      } catch (e) {
        notes.push(`headless error: ${(e as Error).message}`)
        if (staticHtml) return { html: staticHtml, mode: 'static' }
        return { html: null, mode: 'none' }
      }
    }

    let initialHtml = await fetchHtml('static').catch(e => {
      notes.push(`static error: ${(e as Error).message}`)
      return null
    })
    let usedMode: 'static' | 'headless' | 'none' = initialHtml && initialHtml.trim() ? 'static' : 'none'
    if (!initialHtml || !initialHtml.trim() || !hasListingMarkers(initialHtml)) {
      const manual = await getHtml(baseUrl, { expectListing: true }).catch(() => ({
        html: null,
        mode: 'none' as const,
      }))
      if (manual?.html && manual.html.trim() && hasListingMarkers(manual.html)) {
        initialHtml = manual.html
        usedMode = manual.mode
        notes.push('fetched listing via direct HTTP fetch')
      }
    }
    if (!initialHtml || !initialHtml.trim() || !hasListingMarkers(initialHtml)) {
      const h = await fetchHtml('headless').catch(e => {
        notes.push(`headless error: ${(e as Error).message}`)
        return null
      })
      if (h && h.trim()) {
        initialHtml = h
        usedMode = 'headless'
      } else if (initialHtml && !hasListingMarkers(initialHtml)) {
        notes.push('static fetch lacked listing markers; headless unavailable or empty')
      }
    }
    if (!initialHtml || !initialHtml.trim()) {
      throw new Error('DiscoveryError: No HTML available for category')
    }

    const $0 = cheerio.load(initialHtml)
    const canonicalRaw = ($0('link[rel="canonical"]').attr('href') || '').trim()
    const canonical = (() => {
      if (!canonicalRaw) return null
      try {
        const u = new URL(canonicalRaw)
        return BASE_PATH_REGEX.test(u.pathname) ? u.toString() : null
      } catch {
        return null
      }
    })()
    const startUrl = canonical || baseUrl
    addAllowedPrefix(startUrl)

    const productUrls = new Set<string>()
    const pageQueue: string[] = [startUrl]
    const visited = new Set<string>()
    let lastTilesTotal = 0
    let pagesVisited = 0
    let expectedResults: number | null = null
    let hasNestedCategories = false

    const extractTileLinks = ($: cheerio.CheerioAPI): string[] => {
      const urls = new Set<string>()
      const selector = [
        '#ListingProducts a.product-title[href]',
        '#ListingProducts .product-title a[href]',
        '#ListingProducts .ejs-productitem .product-title a[href]',
        '#ListingProducts .productbox .product-title a[href]',
      ].join(', ')
      $(selector).each((_i, el) => {
        const href = String($(el).attr('href') || '').trim()
        if (!href) return
        try {
          const abs = toAbs(href)
          const u = new URL(abs)
          if (!u.hostname.endsWith('batsonenterprises.com')) return
          if (!isAllowedPath(u.pathname)) return
          urls.add(u.toString())
        } catch {
          /* ignore invalid URLs */
        }
      })
      return Array.from(urls)
    }

    const getProductsTotalCount = ($: cheerio.CheerioAPI): number | null => {
      const raw = String($('#ProductsTotalCount').attr('value') || $('[name="ProductsTotalCount"]').attr('value') || '')
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    }

    const getLastPageNumber = ($: cheerio.CheerioAPI): number | null => {
      const raw = String($('#LastPageNumber').attr('value') || $('[name="LastPageNumber"]').attr('value') || '')
      const n = Number(raw)
      return Number.isFinite(n) && n >= 1 ? n : null
    }

    const collectPagination = ($: cheerio.CheerioAPI): string[] => {
      const links: string[] = []
      const add = (u: string) => {
        try {
          const x = new URL(toAbs(u))
          if (!isAllowedPath(x.pathname)) return
          links.push(x.toString())
        } catch {
          /* ignore */
        }
      }
      $('link[rel="next"]').each((_i, el) => {
        const href = String($(el).attr('href') || '').trim()
        if (href) add(href)
      })
      $('a[href]').each((_i, a) => {
        const href = String($(a).attr('href') || '').trim()
        const txt = ($(a).text() || '').toLowerCase()
        const cls = String($(a).attr('class') || '').toLowerCase()
        if (!href) return
        const u = toAbs(href)
        if (/\bnext\b/.test(txt) || /page=\d+/.test(u) || /\bpage\b/.test(cls) || /pagination|pager/.test(cls)) {
          add(u)
        }
      })
      return Array.from(new Set(links))
    }

    const parseResultsCount = ($: cheerio.CheerioAPI): number | null => {
      const body = $.text() || ''
      const m = body.match(/(\d{1,5})\s+Results/i)
      if (m) {
        const n = Number(m[1])
        if (Number.isFinite(n)) return n
      }
      return null
    }

    const collectSubcategories = ($: cheerio.CheerioAPI): string[] => {
      const subs = new Set<string>()
      $('#ListingCategories a[href]').each((_i, el) => {
        const href = String($(el).attr('href') || '').trim()
        if (!href) return
        try {
          const abs = toAbs(href)
          const u = new URL(abs)
          if (!u.hostname.endsWith('batsonenterprises.com')) return
          addAllowedPrefix(u.toString())
          subs.add(u.toString())
        } catch {
          /* ignore */
        }
      })
      return Array.from(subs)
    }

    const MAX_PAGES = 120
    let seededPageQueue = false
    while (pageQueue.length && pagesVisited < MAX_PAGES) {
      const url = pageQueue.shift()!
      if (!url || visited.has(url)) continue
      visited.add(url)
      pagesVisited++
      const { html, mode } = await getHtml(url, { expectListing: true })
      if (!html || !html.trim()) continue
      if (mode === 'headless' && usedMode === 'static') usedMode = 'headless'
      const $ = cheerio.load(html)
      if (expectedResults == null) {
        expectedResults = getProductsTotalCount($) ?? parseResultsCount($)
      }
      if (!seededPageQueue) {
        const lastPage = getLastPageNumber($)
        if (lastPage && lastPage > 1) {
          const base = new URL(startUrl)
          for (let page = 2; page <= lastPage && page <= MAX_PAGES; page++) {
            const u = new URL(base.toString())
            u.searchParams.set('page', String(page))
            const nextUrl = u.toString()
            if (!visited.has(nextUrl)) pageQueue.push(nextUrl)
          }
        }
        seededPageQueue = true
      }
      const links = extractTileLinks($)
      if (links.length === 0) {
        notes.push(`no tiles via ${mode} at ${url}`)
      }
      for (const u of links) productUrls.add(u)
      const subcategories = collectSubcategories($)
      if (subcategories.length) hasNestedCategories = true
      for (const next of subcategories) {
        if (!visited.has(next)) pageQueue.push(next)
      }
      const tilesNow = productUrls.size
      const more = collectPagination($)
      for (const m of more) if (!visited.has(m)) pageQueue.push(m)
      if (tilesNow <= lastTilesTotal && pageQueue.length === 0) break
      lastTilesTotal = tilesNow
      await sleep(800)
    }

    if (productUrls.size === 0) {
      const detail = notes.length ? ` Details: ${notes.join(' | ')}` : ''
      throw new Error(`DiscoveryError: No product tiles found.${detail}`)
    }

    if (!hasNestedCategories && expectedResults != null && productUrls.size !== expectedResults) {
      throw new Error(
        `DiscoveryError: Found ${productUrls.size} URLs but page reports ${expectedResults} Result(s). Adjust selectors.`,
      )
    }

    const VALIDATE_MAX = 40
    const candidates = Array.from(productUrls).slice(0, VALIDATE_MAX)
    const valid = new Set<string>()
    let validated = 0
    for (const u of candidates) {
      try {
        const { html } = await getHtml(u)
        if (!html || !html.trim()) continue
        const $ = cheerio.load(html)
        const hasTitle = Boolean(
          $('.page-title h1, h1.product-name, h1.product_title, h1.product-title, h1.product__title')
            .first()
            .text()
            .trim(),
        )
        const hasCart = Boolean(
          $('form[action*="cart"], form[action*="/Cart"], button[name="add"], .add-to-cart, #AddToCartForm').length,
        )
        const hasGrid = Boolean($('.attribute-grid tbody').length)
        if (hasTitle || hasCart || hasGrid) valid.add(u)
      } catch {
        /* ignore */
      }
      validated++
      if (validated % 5 === 0) await sleep(400)
    }
    const validationSample = candidates.length ? `${valid.size}/${candidates.length}` : '0/0'
    if (candidates.length && valid.size < Math.ceil(candidates.length * 0.4)) {
      notes.push(`validation confidence low (${validationSample} detail pages passed)`)
    }

    const finalList = Array.from(new Set(productUrls))

    let warning: string | undefined
    if (expectedResults != null && expectedResults > 0) {
      const diff = Math.abs(finalList.length - expectedResults)
      const pct = expectedResults > 0 ? (diff / expectedResults) * 100 : 0
      if (pct > 5) warning = `discovered ${finalList.length} vs expected ${expectedResults} (diff ${pct.toFixed(1)}%)`
    }

    return {
      seeds: finalList.map(u => ({ url: u })),
      debug: {
        strategyTried: ['tiles', 'pagination', 'validation'],
        strategyUsed: 'pagination+scroll',
        totalFound: finalList.length,
        deduped: finalList.length,
        sample: finalList.slice(0, 5),
        notes: warning ? notes.concat([warning]) : notes,
        pagesVisited,
        expectedResults,
      },
      usedMode,
    }
  },
}
// <!-- END RBP GENERATED: importer-discover-unified-v1 -->
