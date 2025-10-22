// hq-importer-new-import-v2
export type Scraper = {
  id: string
  name: string
  kind: 'scraper'
  strategy: 'jsonld' | 'dom' | 'list'
  // Optional DOM field selectors for 'dom' strategy
  fields?: {
    title?: string
    price?: string
    sku?: string
    option1?: string
    option2?: string
    option3?: string
    image?: string
  }
}

const PRELOADED_SCRAPERS: Scraper[] = [
  {
    id: 'jsonld-basic',
    name: 'JSON-LD Scraper',
    kind: 'scraper',
    strategy: 'jsonld',
  },
  {
    id: 'dom-selectors-v1',
    name: 'DOM Selector Scraper',
    kind: 'scraper',
    strategy: 'dom',
    fields: {
      title: 'h1, .product__title, [itemprop="name"]',
      price: '[itemprop="price"], .price__regular, .price .amount',
      sku: '[itemprop="sku"], .sku',
      option1: 'select[name*="option1"], .product-form__input:first-of-type',
      option2: 'select[name*="option2"], .product-form__input:nth-of-type(2)',
      option3: 'select[name*="option3"], .product-form__input:nth-of-type(3)',
      image: 'img[src*="/products/"]',
    },
  },
  {
    id: 'list-page-follow-v1',
    name: 'List Page Scraper (follow links)',
    kind: 'scraper',
    strategy: 'list',
  },
]

export async function listScrapers(): Promise<Scraper[]> {
  return PRELOADED_SCRAPERS
}

export async function getScraperById(id: string): Promise<Scraper | undefined> {
  return PRELOADED_SCRAPERS.find(s => s.id === id)
}
