// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
import { crawlBatsonRodBlanksListing as crawlRaw } from '../crawlers/batsonListing'
// <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
import * as cheerio from 'cheerio'
// <!-- END RBP GENERATED: importer-discover-hardening-v1 -->

export type DiscoverSeed = { url: string }
export type DiscoverResult = {
  seeds: DiscoverSeed[]
  debug: {
    totalFound: number
    deduped: number
    sample?: string[]
    notes?: string[]
    strategyUsed?: string
    strategyTried?: string[]
  }
}

// Wrapper that adapts the crawler outputs into a richer DiscoverResult shape
export function crawlBatsonRodBlanksListing(html: string, base: string): DiscoverResult {
  const urls = crawlRaw(html, base)
  let uniq = Array.from(new Set(urls))
  const tried: string[] = ['batson-listing']
  let used = 'batson-listing'

  // <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
  // Strategy 0: proximity to an h* heading that contains "Blanks by series"
  if (uniq.length === 0) {
    tried.push('heading-proximity')
    try {
      const $ = cheerio.load(html)
      const heading = $('h1,h2,h3,h4,h5')
        .filter((_i, el) => {
          const t = $(el).text().trim().toLowerCase()
          return t.includes('blanks by series') || t.includes('by series')
        })
        .first()
      if (heading && heading.length) {
        const section = heading.parent()
        const nearAnchors = section.find('a[href]').add(section.nextAll().slice(0, 2).find('a[href]'))
        const found = new Set<string>()
        nearAnchors.each((_i, a) => {
          const href = ($(a).attr('href') || '').trim()
          if (!href) return
          const abs = /^https?:/i.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`
          try {
            const p = new URL(abs).pathname.toLowerCase()
            if (
              /^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(p) &&
              !/\.(jpg|jpeg|png|gif|webp|pdf|zip)$/.test(p) &&
              !/\/(cart|account|search|checkout|contact)\b/.test(p)
            ) {
              found.add(abs)
            }
          } catch {
            /* ignore */
          }
        })
        if (found.size) {
          uniq = Array.from(found)
          used = 'heading-proximity'
        }
      }
    } catch {
      /* ignore */
    }
  }
  // <!-- END RBP GENERATED: importer-discover-hardening-v1 -->

  return {
    seeds: uniq.map(u => ({ url: u })),
    debug: {
      totalFound: urls.length,
      deduped: uniq.length,
      sample: uniq.slice(0, 5),
      notes: [],
      strategyUsed: used,
      strategyTried: tried,
    },
  }
}
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
