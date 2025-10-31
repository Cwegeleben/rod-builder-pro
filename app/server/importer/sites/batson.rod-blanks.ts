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
