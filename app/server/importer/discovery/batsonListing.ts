// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
import { crawlBatsonRodBlanksListing as crawlRaw } from '../crawlers/batsonListing'

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
  const uniq = Array.from(new Set(urls))
  return {
    seeds: uniq.map(u => ({ url: u })),
    debug: {
      totalFound: urls.length,
      deduped: uniq.length,
      sample: uniq.slice(0, 5),
      notes: [],
      strategyUsed: 'batson-listing',
      strategyTried: ['batson-listing'],
    },
  }
}
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
