// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import * as cheerio from 'cheerio'

const normalize = (href: string, base: string) => {
  let h = href.trim().replace(/[#?].*$/, '')
  if (!/^https?:\/\//i.test(h)) h = `${base}${h.startsWith('/') ? '' : '/'}${h}`
  return h
}

/**
 * Batson "Blanks-by-series" crawler
 * Selectors: prefer canonical /blanks-by-series links via multiple patterns; normalize and dedupe.
 */
export function crawlBatsonBlanksbySeries(html: string, base: string): string[] {
  const $ = cheerio.load(html)
  const out = new Set<string>()

  // Primary selectors
  $('.ejs-product-image-container[data-product-url]').each((_, el) => {
    const v = $(el).attr('data-product-url')
    if (v?.startsWith('/blanks-by-series/')) out.add(normalize(v, base))
  })

  $('li.product-title a[href]').each((_, el) => {
    const v = $(el).attr('href')
    if (v?.includes('/blanks-by-series/')) out.add(normalize(v, base))
  })

  $('.box-price a.btn[href]').each((_, el) => {
    const v = $(el).attr('href')
    if (v?.includes('/blanks-by-series/')) out.add(normalize(v, base))
  })

  // Fallbacks
  $('.ejs-productitem a[href]').each((_, el) => {
    const v = $(el).attr('href')
    if (v?.includes('/blanks-by-series/')) out.add(normalize(v, base))
  })

  $('a[href*="/blanks-by-series/"]').each((_, el) => {
    const v = $(el).attr('href')
    if (v) out.add(normalize(v, base))
  })

  // Generic attribute-based extraction (in case class names shift)
  $('[data-product-url*="/blanks-by-series/"]').each((_, el) => {
    const v = $(el).attr('data-product-url')
    if (v) out.add(normalize(v, base))
  })

  // Last-resort regex scan of raw HTML to capture inline JS and attributes
  try {
    const re = /\b(?:href|data-product-url)\s*=\s*"(\/blanks-by-series\/[^"]+)"/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const v = m[1]
      if (v) out.add(normalize(v, base))
    }
    const reSingle = /\b(?:href|data-product-url)\s*=\s*'(\/blanks-by-series\/[^']+)'/gi
    while ((m = reSingle.exec(html)) !== null) {
      const v = m[1]
      if (v) out.add(normalize(v, base))
    }
    const re2 = /\b\/(blanks-by-series\/[A-Za-z0-9_-]+)\b/g
    while ((m = re2.exec(html)) !== null) {
      const v = `/${m[1]}`
      if (v) out.add(normalize(v, base))
    }
  } catch {
    // ignore regex issues
  }

  const list = Array.from(out).filter(u => new URL(u).pathname.startsWith('/blanks-by-series/'))
  list.sort((a, b) => a.localeCompare(b))
  return list
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-paginate-v1 -->
type DiscoverAllResult = { urls: string[]; debug: { pagesVisited: number; fromRelNext: number; fromHeuristic: number } }

function buildHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }
}

function toAbsolute(href: string, base: string): string {
  try {
    if (/^https?:\/\//i.test(href)) return href
    const u = new URL(base)
    const path = href.startsWith('/') ? href : `/${href}`
    return `${u.protocol}//${u.hostname}${path}`
  } catch {
    return href
  }
}

/**
 * Discover all Batson "blanks-by-series" URLs by following rel="next" pagination
 * and falling back to numeric page= heuristics until no new series links are found.
 */
export async function discoverBatsonSeriesAllPages(
  startUrl = 'https://batsonenterprises.com/blanks-by-series',
  opts?: { maxPages?: number; timeoutMs?: number },
): Promise<DiscoverAllResult> {
  const MAX = Math.max(1, Math.min(100, opts?.maxPages ?? 20))
  const timeoutMs = Math.max(2000, Math.min(30000, opts?.timeoutMs ?? 8000))

  let url = startUrl
  try {
    const u = new URL(url)
    if (u.hostname !== 'batsonenterprises.com' || !u.pathname.startsWith('/blanks-by-series')) {
      throw new Error('Off-canonical startUrl')
    }
  } catch (e) {
    throw new Error(`Invalid startUrl: ${String(e instanceof Error ? e.message : e)}`)
  }

  const headers = buildHeaders()
  const visited = new Set<string>()
  const series = new Set<string>()
  let pagesVisited = 0
  let fromRelNext = 0
  let fromHeuristic = 0

  async function fetchWithTimeout(u: string): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fetch(u, { headers, signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  for (let i = 0; i < MAX; i++) {
    if (visited.has(url)) break
    visited.add(url)
    pagesVisited++

    let res: Response
    try {
      res = await fetchWithTimeout(url)
    } catch {
      break
    }
    if (!res.ok) break
    const html = await res.text()
    const base = `${new URL(url).protocol}//${new URL(url).hostname}`
    const found = crawlBatsonBlanksbySeries(html, base)
    for (const u of found) series.add(u)

    // Try rel="next" first
    let next: string | null = null
    try {
      const $ = cheerio.load(html)
      const relNext = $('link[rel="next"]').attr('href') || $('a[rel="next"]').attr('href') || ''
      if (relNext) next = toAbsolute(relNext, base)
    } catch {
      /* ignore */
    }

    if (next && !visited.has(next)) {
      fromRelNext++
      url = next
      continue
    }

    // Fallback: numeric page heuristic
    try {
      const cur = new URL(url)
      const curPage = Number(cur.searchParams.get('page') || '1') || 1
      const nextPage = curPage + 1
      cur.searchParams.set('page', String(nextPage))
      const candidate = cur.toString()
      if (!visited.has(candidate)) {
        // Stop if requesting next page produces no new links compared to last iteration
        const beforeCount = series.size
        let ok = true
        try {
          const r2 = await fetchWithTimeout(candidate)
          if (!r2.ok) ok = false
          else {
            const h2 = await r2.text()
            const f2 = crawlBatsonBlanksbySeries(h2, base)
            for (const u of f2) series.add(u)
          }
        } catch {
          ok = false
        }
        const afterCount = series.size
        if (ok && afterCount > beforeCount) {
          fromHeuristic++
          url = candidate
          continue
        }
      }
    } catch {
      /* ignore */
    }
    // No next page discovered
    break
  }

  return {
    urls: Array.from(series).sort((a, b) => a.localeCompare(b)),
    debug: { pagesVisited, fromRelNext, fromHeuristic },
  }
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-paginate-v1 -->

// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-rod-blanks-paginate-v1 -->
/**
 * Discover all Batson rod blanks detail/series URLs starting from /rod-blanks.
 * Strategy:
 *  1. Fetch each page (following rel="next" or numeric page heuristic) up to maxPages.
 *  2. Extract anchors containing "/rod-blanks/" that look like individual blank pages (exclude obvious collection/pagination links).
 *  3. Deduplicate and return sorted list.
 */
export async function discoverBatsonRodBlanksAllPages(
  startUrl = 'https://batsonenterprises.com/rod-blanks',
  opts?: { maxPages?: number; timeoutMs?: number; perPage?: number },
): Promise<DiscoverAllResult> {
  const MAX = Math.max(1, Math.min(100, opts?.maxPages ?? 30))
  const timeoutMs = Math.max(2000, Math.min(30000, opts?.timeoutMs ?? 8000))
  // Normalize start URL and apply optional per-page preference and page=1
  let url = startUrl
  try {
    const u = new URL(url)
    const isRodBlanks = u.pathname.startsWith('/rod-blanks')
    const isCollectionBlanks = u.pathname.startsWith('/collections/blanks')
    if (u.hostname !== 'batsonenterprises.com' || (!isRodBlanks && !isCollectionBlanks)) {
      throw new Error('Off-canonical startUrl')
    }
    // Force static pagination mode (avoid infinite scroll), and prefer explicit page=1
    u.searchParams.set('view', 'all')
    // If caller asked for a specific page size, try common params used by Shopify themes
    if (opts?.perPage && Number.isFinite(opts.perPage) && opts.perPage > 0) {
      u.searchParams.set('page_size', String(opts.perPage))
      u.searchParams.set('limit', String(opts.perPage))
    }
    // Ensure we start at page=1 if not explicitly provided
    if (!u.searchParams.get('page')) {
      u.searchParams.set('page', '1')
    }
    url = u.toString()
  } catch (e) {
    throw new Error(`Invalid startUrl: ${String(e instanceof Error ? e.message : e)}`)
  }
  const headers = buildHeaders()
  const visited = new Set<string>()
  const blanks = new Set<string>()
  let pagesVisited = 0
  let fromRelNext = 0
  let fromHeuristic = 0

  async function fetchWithTimeout(u: string): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fetch(u, { headers, signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  const collectFromHtml = (html: string, base: string) => {
    const $ = cheerio.load(html)
    $('a[href*="/rod-blanks/"], a[href*="/products/"], a[href*="/ecom/"]').each((_i, a) => {
      const href = $(a).attr('href') || ''
      if (!href) return
      const abs = toAbsolute(href, base)
      try {
        const u = new URL(abs)
        // Filter out pagination or non-detail patterns (keep slugs with letters/numbers, exclude query-only links)
        if (
          !u.pathname.startsWith('/rod-blanks') &&
          !u.pathname.startsWith('/products/') &&
          !u.pathname.startsWith('/ecom/')
        )
          return
        const segs = u.pathname.split('/').filter(Boolean)
        const last = segs.pop() || ''
        if (/^(page|p)\d+$/i.test(last)) return
        if (last.length < 3) return
        // Avoid adding base listing pages
        if (u.pathname === '/rod-blanks' || u.pathname === '/collections/blanks') return
        blanks.add(abs)
      } catch {
        /* ignore */
      }
    })
    // Tiles sometimes store the URL in data-product-url
    $('[data-product-url]').each((_i, el) => {
      const href = String($(el).attr('data-product-url') || '')
      if (!href) return
      const abs = toAbsolute(href, base)
      try {
        const u = new URL(abs)
        if (!u.pathname.startsWith('/rod-blanks') && !u.pathname.startsWith('/products/')) return
        if (u.pathname === '/rod-blanks' || u.pathname === '/collections/blanks') return
        blanks.add(abs)
      } catch {
        /* ignore */
      }
    })
    // Regex fallback for inline attributes
    try {
      const rx = /\b(?:href|data-product-url)\s*=\s*"((?:\/rod-blanks\/|\/products\/|\/ecom\/)[^"]+)"/gi
      let m: RegExpExecArray | null
      while ((m = rx.exec(html)) !== null) {
        blanks.add(toAbsolute(m[1], base))
      }
      const rx2 = /\b(?:href|data-product-url)\s*=\s*'((?:\/rod-blanks\/|\/products\/|\/ecom\/)[^']+)'/gi
      while ((m = rx2.exec(html)) !== null) {
        blanks.add(toAbsolute(m[1], base))
      }
    } catch {
      /* ignore */
    }
  }

  let discoveredLastPage: number | null = null

  for (let i = 0; i < MAX; i++) {
    if (visited.has(url)) break
    visited.add(url)
    pagesVisited++
    let res: Response
    try {
      res = await fetchWithTimeout(url)
    } catch {
      break
    }
    if (!res.ok) break
    let html = await res.text()
    const base = `${new URL(url).protocol}//${new URL(url).hostname}`
    const beforeCount = blanks.size
    collectFromHtml(html, base)
    // If static HTML yielded nothing new, try a headless render to allow client JS to populate tiles
    if (blanks.size === beforeCount) {
      try {
        const mod = await import('../../headless/renderHeadlessHtml')
        const renderHeadlessHtml: (u: string, o?: { timeoutMs?: number }) => Promise<string> = (mod as any)
          .renderHeadlessHtml
        const h = await renderHeadlessHtml(url, { timeoutMs: Math.min(timeoutMs, 20000) })
        if (h && typeof h === 'string') {
          html = h
          collectFromHtml(html, base)
        }
      } catch {
        /* ignore headless issues */
      }
    }
    // rel="next"
    let next: string | null = null
    try {
      const $ = cheerio.load(html)
      const relNext = $('link[rel="next"]').attr('href') || $('a[rel="next"]').attr('href') || ''
      if (relNext) next = toAbsolute(relNext, base)
      // Also detect explicit "View More" button/link pattern
      if (!next) {
        const viewMore = $('#cmdViewMore').attr('href') || $('a.btn-view-more').attr('href') || ''
        if (viewMore) next = toAbsolute(viewMore, base)
      }
      // Detect LastPageNumber from hidden inputs
      const lastVal = $('input#LastPageNumber, input[name="LastPageNumber"]').attr('value') || ''
      const n = Number(lastVal)
      if (Number.isFinite(n) && n > 0) discoveredLastPage = n
    } catch {
      /* ignore */
    }
    if (next && !visited.has(next)) {
      fromRelNext++
      url = next
      continue
    }
    // Numeric heuristic page param (preserve perPage hint across pages)
    try {
      const cur = new URL(url)
      const curPage = Number(cur.searchParams.get('page') || '1') || 1
      const nextPage = curPage + 1
      // Stop if we know the last page
      if (discoveredLastPage && nextPage > discoveredLastPage) break
      cur.searchParams.set('page', String(nextPage))
      cur.searchParams.set('view', 'all')
      if (opts?.perPage && Number.isFinite(opts.perPage) && opts.perPage > 0) {
        cur.searchParams.set('page_size', String(opts.perPage))
        cur.searchParams.set('limit', String(opts.perPage))
      }
      const candidate = cur.toString()
      if (!visited.has(candidate)) {
        const before = blanks.size
        let ok = true
        try {
          const r2 = await fetchWithTimeout(candidate)
          if (!r2.ok) ok = false
          else {
            const h2 = await r2.text()
            collectFromHtml(h2, base)
          }
        } catch {
          ok = false
        }
        if (ok && blanks.size > before) {
          fromHeuristic++
          url = candidate
          continue
        }
      }
    } catch {
      /* ignore */
    }
    break
  }
  return {
    urls: Array.from(blanks).sort((a, b) => a.localeCompare(b)),
    debug: { pagesVisited, fromRelNext, fromHeuristic },
  }
}
// <!-- END RBP GENERATED: importer-v2-3-batson-rod-blanks-paginate-v1 -->
