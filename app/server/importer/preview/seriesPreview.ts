// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { fetchPage } from '../../../services/importer/fetchPage'

export type SeriesProduct = { title?: string | null; url: string; price?: number | null; status?: string | null }

function toAbs(src: string, base: string) {
  try {
    return src.startsWith('http') ? src : new URL(src, base).toString()
  } catch {
    return src
  }
}
function normPrice(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const m = v.replace(/[\s,]/g, '').match(/([0-9]+(?:\.[0-9]+)?)/)
    return m ? Number(m[1]) : null
  }
  return null
}

export async function seriesPreview(url: string): Promise<{ products: SeriesProduct[] }> {
  const page = await fetchPage({ url, snapshotMaxLength: 300_000 })
  if (!page.html) return { products: [] }
  const html = page.html
  const products: SeriesProduct[] = []
  // Try list-grid anchors within the series page
  const aRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  const seen = new Set<string>()
  while ((m = aRe.exec(html))) {
    const href = toAbs(m[1], url)
    const text = (m[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!/\/products\//i.test(href)) continue
    if (seen.has(href)) continue
    seen.add(href)
    products.push({ url: href, title: text || null, price: null, status: null })
    if (products.length >= 20) break
  }
  // Fallback: look for price decorations near anchors
  if (products.length < 5) {
    const rowRe = /<div[^>]*class=["'][^"']*(?:product|grid|tile)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
    while ((m = rowRe.exec(html))) {
      const block = m[0]
      const href = block.match(/href=["']([^"']+)["']/i)?.[1]
      if (!href) continue
      const abs = toAbs(href, url)
      if (seen.has(abs)) continue
      const priceTxt = block.match(/\$\s*[0-9][0-9,.]*/i)?.[0] || null
      const title = block.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i)?.[1] || null
      products.push({ url: abs, title, price: normPrice(priceTxt), status: null })
      if (products.length >= 20) break
    }
  }
  return { products }
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
