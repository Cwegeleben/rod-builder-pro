// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import { parseHtml, selectAll } from '../../lib/html'

export interface PaginationConfig {
  mode: 'nextSelector' | 'urlPattern'
  nextSelector?: string // CSS selector for a link/button to next page
  urlPattern?: string // e.g. https://site.com/list?page={page}
  startPage?: number
  maxPages?: number
}

export function extractNextUrl(html: string, currentUrl: string, cfg: PaginationConfig): string | null {
  if (cfg.mode === 'nextSelector' && cfg.nextSelector) {
    const doc = parseHtml(html)
    const link = selectAll(doc, cfg.nextSelector)[0]
    if (!link) return null
    const href = link.getAttribute('href') || ''
    if (!href) return null
    return new URL(href, currentUrl).toString()
  }
  if (cfg.mode === 'urlPattern' && cfg.urlPattern) {
    const u = new URL(currentUrl)
    const pageParamMatch = /{page}/
    if (!pageParamMatch.test(cfg.urlPattern)) return null
    const currentPage = parseInt(u.searchParams.get('page') || String(cfg.startPage || 1), 10)
    const nextPage = currentPage + 1
    if (cfg.maxPages && nextPage > (cfg.startPage || 1) + (cfg.maxPages - 1)) return null
    return cfg.urlPattern.replace('{page}', String(nextPage))
  }
  return null
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
