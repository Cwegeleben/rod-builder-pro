// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
export type SiteConfig = {
  id: string
  match: (url: string) => boolean
  discovery: { model: 'batson-listing' | 'sitemap' | 'grid' | 'regex'; headless: boolean }
  products: { scrapeType: 'auto' | 'batson-attribute-grid' }
}

export const BatsonRodBlanksConfig: SiteConfig = {
  id: 'batson-rod-blanks',
  match: (url: string) => {
    try {
      const u = new URL(url)
      if (!/batsonenterprises\.com$/i.test(u.hostname)) return false
      return /^\/rod-blanks\/?$/i.test(u.pathname) || /^\/rod-blanks\//i.test(u.pathname)
    } catch {
      return false
    }
  },
  discovery: { model: 'batson-listing', headless: true },
  products: { scrapeType: 'batson-attribute-grid' },
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
import type { DiscoverResult } from '../discovery/batsonListing'
import { crawlBatsonRodBlanksListing as runBatsonListing } from '../discovery/batsonListing'

// File-driven site object with an inline discover runner that tries static first then headless
export const BatsonRodBlanksSite = {
  id: 'batson-rod-blanks',
  match(url: string) {
    try {
      const u = new URL(url)
      return u.hostname.endsWith('batsonenterprises.com') && u.pathname.replace(/\/+$/, '') === '/rod-blanks'
    } catch {
      return false
    }
  },
  async discover(
    fetchHtml: (mode: 'static' | 'headless') => Promise<string | null>,
    baseUrl: string,
  ): Promise<DiscoverResult & { usedMode: 'static' | 'headless' | 'none' }> {
    const staticHtml = await fetchHtml('static')
    if (staticHtml && staticHtml.trim()) {
      const res = runBatsonListing(staticHtml, baseUrl)
      if (res.seeds.length > 0) return { ...res, usedMode: 'static' }
    }
    const headlessHtml = await fetchHtml('headless')
    if (headlessHtml && headlessHtml.trim()) {
      const res = runBatsonListing(headlessHtml, baseUrl)
      if (res.seeds.length > 0) return { ...res, usedMode: 'headless' }
    }
    return {
      seeds: [],
      debug: {
        // <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
        strategyTried: ['heading-proximity', 'grid', 'nav', 'list', 'jsonld', 'heuristic'],
        strategyUsed: 'heuristic',
        totalFound: 0,
        deduped: 0,
        sample: [],
        notes: ['No series links discovered in static or headless HTML.'],
        // <!-- END RBP GENERATED: importer-discover-hardening-v1 -->
      },
      usedMode: staticHtml ? 'static' : headlessHtml ? 'headless' : 'none',
    }
  },
}
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
