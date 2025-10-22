// hq-importer-new-import-v2
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getScraperById, listScrapers } from '../services/importer/scrapers.server'
import { fetchActiveSources } from '../../packages/importer/src/seeds/sources'

type PreviewItem = {
  title?: string | null
  sku?: string | null
  price?: number | null
  options?: { o1?: string | null; o2?: string | null; o3?: string | null }
  url: string
  status: string
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const ct = request.headers.get('content-type') || ''
  const read = async () => {
    if (/application\/json/i.test(ct)) {
      const body = await request.json().catch(() => ({}))
      return body as Record<string, unknown>
    }
    const fd = await request.formData().catch(() => null)
    const o: Record<string, unknown> = {}
    if (fd) {
      o.variantTemplateId = String(fd.get('variantTemplateId') || '') || undefined
      o.scraperId = String(fd.get('scraperId') || '') || undefined
      o.includeDiscovered = fd.get('includeDiscovered') === 'on'
      try {
        o.urls = JSON.parse(String(fd.get('urls') || '[]'))
      } catch {
        o.urls = []
      }
    }
    return o
  }
  const {
    variantTemplateId,
    scraperId,
    urls: rawUrls,
    includeDiscovered,
    skipSuccessful,
  } = (await read()) as {
    variantTemplateId?: string
    scraperId?: string
    urls?: string[]
    includeDiscovered?: boolean
    skipSuccessful?: boolean
  }

  // Compose URL set
  const manual = Array.isArray(rawUrls) ? (rawUrls as string[]) : []
  const supplierId = 'batson' // current supplier scope; scrapers are generic
  const saved = includeDiscovered ? (await fetchActiveSources(supplierId)).map((s: { url: string }) => s.url) : []
  const urls = Array.from(new Set([...saved, ...manual])).slice(0, 50)

  // Resolve scraper (default to jsonld)
  const scraper = (await getScraperById(scraperId || '')) || (await listScrapers()).find(s => s.id === 'jsonld-basic')!

  const items: PreviewItem[] = []
  const errors: { url: string; message: string }[] = []

  // Simple helpers using global fetch + minimal parsing
  const fetchHtml = async (u: string) => (await fetch(u, { redirect: 'follow' })).text()
  const parseJsonLd = (html: string) => {
    const out: PreviewItem[] = []
    const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const s of scripts) {
      const m = s.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
      if (!m) continue
      try {
        const data = JSON.parse(m[1])
        const nodes = Array.isArray(data) ? data : [data]
        for (const n of nodes) {
          const t = (n['@type'] || n['type'] || '').toString().toLowerCase()
          if (t.includes('product') || n['sku'] || n['name']) {
            out.push({
              title: (n['name'] as string) || null,
              sku: (n['sku'] as string) || null,
              price: typeof n['offers']?.price === 'number' ? (n['offers']?.price as number) : null,
              options: { o1: null, o2: null, o3: null },
              url: (n['url'] as string) || '',
              status: 'ok',
            })
          }
          if (t.includes('itemlist') && Array.isArray(n['itemListElement'])) {
            for (const el of n['itemListElement']) {
              const it = el?.item || el
              if (it?.name || it?.url) {
                out.push({ title: it.name || null, url: it.url || '', status: 'ok' })
              }
            }
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    }
    return out
  }

  const parseListLinks = (html: string, baseUrl: string) => {
    // Heuristic: collect /products/ links
    const out: string[] = []
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const href = m[1]
      const abs = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
      if (/\/products\//.test(abs)) out.push(abs)
    }
    return Array.from(new Set(out))
  }

  for (const u of urls) {
    try {
      const html = await fetchHtml(u)
      if (scraper.strategy === 'jsonld') {
        const rows = parseJsonLd(html)
        if (rows.length) items.push(...rows.map(r => ({ ...r, url: r.url || u })))
        else items.push({ url: u, status: 'no-jsonld' })
      } else if (scraper.strategy === 'list') {
        const links = parseListLinks(html, u).slice(0, 50)
        for (const link of links) items.push({ url: link, title: null, status: 'discovered' })
      } else if (scraper.strategy === 'dom') {
        // Lightweight regex-based extraction as a placeholder (no full DOM in Node)
        const getText = (sel: string | undefined) => (sel ? null : null)
        items.push({ url: u, title: null, sku: null, price: null, options: {}, status: 'ok' })
      }
    } catch (e) {
      errors.push({ url: u, message: (e as Error).message })
    }
  }

  return json({ items, errors })
}

export default function ImporterPreviewApi() {
  return null
}
