// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
export type ScrapeType = 'auto' | 'batson-attribute-grid'
export type Strategy = 'static' | 'headless' | 'hybrid'

export type ScraperInfo = {
  id: ScrapeType
  label: string
  siteTag?: string
  staticOnly?: boolean
}

export const SCRAPERS: ScraperInfo[] = [
  { id: 'auto', label: 'Auto (generic extractor)' },
  {
    id: 'batson-attribute-grid',
    label: 'Batson Attribute-grid (static, site-specific)',
    siteTag: 'batson',
    staticOnly: true,
  },
]

export function getScraperInfo(id: ScrapeType): ScraperInfo | undefined {
  return SCRAPERS.find(s => s.id === id)
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
