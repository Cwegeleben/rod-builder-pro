// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
import * as cheerio from 'cheerio'

export const BatsonReelSeatsSite = {
  id: 'batson-reel-seats',
  match(url: string) {
    try {
      const u = new URL(url)
      const path = u.pathname.replace(/\/+$/, '')
      return u.hostname.endsWith('batsonenterprises.com') && path === '/reel-seats'
    } catch {
      return false
    }
  },
  async discover(fetchHtml: (mode: 'static' | 'headless') => Promise<string | null>, baseUrl: string) {
    const notes: string[] = []
    // Helper: absolute URL normalizer (drop hash, keep query as-is)
    const toAbs = (href: string) => {
      try {
        const abs = /^https?:/i.test(href) ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`
        const u = new URL(abs)
        u.hash = ''
        return u.toString()
      } catch {
        return href
      }
    }
    // Helper: fetch an arbitrary URL (static first, then headless with scroll)
    async function getHtml(url: string): Promise<{ html: string | null; mode: 'static' | 'headless' | 'none' }> {
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      }
      // Try static
      {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 12000)
        try {
          const r = await fetch(url, { headers, signal: ctrl.signal })
          if (r.ok) {
            const t = await r.text()
            clearTimeout(timer)
            if (t && t.trim()) return { html: t, mode: 'static' }
          }
        } catch {
          /* fall back */
        } finally {
          clearTimeout(timer)
        }
      }
      // Headless fallback with autoScroll
      try {
        const { renderHeadlessHtml } = await import('../../headless/renderHeadlessHtml')
        const t = await renderHeadlessHtml(url, { timeoutMs: 20000, autoScroll: true })
        return { html: t, mode: 'headless' }
      } catch (e) {
        notes.push(`headless error: ${(e as Error).message}`)
        return { html: null, mode: 'none' }
      }
    }

    // Load the initial category HTML using provided abstraction first
    let initialHtml = await fetchHtml('static').catch(e => {
      notes.push(`static error: ${(e as Error).message}`)
      return null
    })
    let usedMode: 'static' | 'headless' | 'none' = initialHtml && initialHtml.trim() ? 'static' : 'none'
    if (!initialHtml || !initialHtml.trim()) {
      const h = await fetchHtml('headless').catch(e => {
        notes.push(`headless error: ${(e as Error).message}`)
        return null
      })
      if (h && h.trim()) {
        initialHtml = h
        usedMode = 'headless'
      }
    }
    if (!initialHtml || !initialHtml.trim()) {
      throw new Error('DiscoveryError: No HTML available for category')
    }

    // Determine starting URL from canonical or default to base + current path
    const $0 = cheerio.load(initialHtml)
    const canonical = ($0('link[rel="canonical"]').attr('href') || '').trim()
    const startUrl = canonical || `${baseUrl}/reel-seats`

    const productUrls = new Set<string>()
    const pageQueue: string[] = [startUrl]
    const visited = new Set<string>()
    let lastTilesTotal = 0
    let pagesVisited = 0
    let expectedResults: number | null = null

    const extractTileLinks = ($: cheerio.CheerioAPI): string[] => {
      // Broad set of tile containers and link hints
      const out: string[] = []
      const TILE_SEL = [
        '#ListingProducts .ejs-productitem',
        '.ejs-productitem',
        '.productgrid .grid__item',
        '.grid .grid__item',
        '.product-item',
        '.product-card',
        '.card--product',
        '.card__content:has(a[href])',
      ].join(', ')
      $(TILE_SEL)
        .find('a[href], [data-product-url]')
        .each((_i, el) => {
          const dataUrl = String($(el).attr('data-product-url') || '').trim()
          const href = String($(el).attr('href') || '').trim()
          const candidate = dataUrl || href
          if (!candidate) return
          const abs = toAbs(candidate)
          try {
            const u = new URL(abs)
            // Accept only product detail pages under /reel-seats/<slug>
            if (!u.hostname.endsWith('batsonenterprises.com')) return
            if (!/^\/reel-seats(\/|$)/.test(u.pathname)) return
            // Exclude the category root and paginated listing URLs
            const path = u.pathname.replace(/\/$/, '')
            if (path === '/reel-seats') return
            if (u.searchParams.has('page')) return
            // Exclude known non-product areas
            if (/\/ecom\//i.test(u.pathname) || /\/collections\//i.test(u.pathname)) return
            out.push(u.toString())
          } catch {
            /* ignore malformed */
          }
        })
      // Fallback: regex scan for common data attributes in the page
      try {
        const html = $.html() || ''
        const reD = /\b(?:href|data-product-url)\s*=\s*"([^"#<>{}]+)"/gi
        let m: RegExpExecArray | null
        while ((m = reD.exec(html))) {
          const abs = toAbs(m[1])
          try {
            const u = new URL(abs)
            if (!u.hostname.endsWith('batsonenterprises.com')) continue
            if (!/^\/reel-seats(\/|$)/.test(u.pathname)) continue
            const path = u.pathname.replace(/\/$/, '')
            if (path === '/reel-seats') continue
            if (u.searchParams.has('page')) continue
            if (/\/ecom\//i.test(u.pathname) || /\/collections\//i.test(u.pathname)) continue
            out.push(u.toString())
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
      return Array.from(new Set(out))
    }
    const collectPagination = ($: cheerio.CheerioAPI): string[] => {
      const links: string[] = []
      const add = (u: string) => {
        try {
          const x = new URL(toAbs(u))
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
        // Heuristics: links that look like page navigation
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

    // BFS over pagination until tile count stops increasing
    const MAX_PAGES = 120
    while (pageQueue.length && pagesVisited < MAX_PAGES) {
      const url = pageQueue.shift()!
      if (!url || visited.has(url)) continue
      visited.add(url)
      pagesVisited++
      const { html, mode } = await getHtml(url)
      if (!html || !html.trim()) continue
      if (mode === 'headless' && usedMode === 'static') usedMode = 'headless'
      const $ = cheerio.load(html)
      // Expected results from any visited page (first non-null wins)
      if (expectedResults == null) expectedResults = parseResultsCount($)
      const links = extractTileLinks($)
      for (const u of links) productUrls.add(u)
      const tilesNow = productUrls.size
      // Enqueue further pages discovered here
      const more = collectPagination($)
      for (const m of more) if (!visited.has(m)) pageQueue.push(m)
      // Stop if no increase after visiting this page AND queue is empty
      if (tilesNow <= lastTilesTotal && pageQueue.length === 0) break
      lastTilesTotal = tilesNow
    }

    // If nothing found, raise discovery error
    if (productUrls.size === 0) {
      throw new Error('DiscoveryError: No product tiles found')
    }

    // Validate detail pages by checking for product-title / add-to-cart markers or attribute-grid (series pages)
    const VALIDATE_MAX = 200
    const candidates = Array.from(productUrls).slice(0, VALIDATE_MAX)
    const valid = new Set<string>()
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
        /* ignore individual candidate errors */
      }
    }
    // Prefer validated set if it has reasonable size; otherwise keep original
    const finalList = valid.size >= 5 ? Array.from(new Set(valid)) : Array.from(new Set(productUrls))

    // Compare to displayed results count
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
