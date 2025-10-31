// Quick preflight to validate discovery for Batson Rod Blanks without Shopify auth
// Prints a JSON summary with usedMode, lengths, title, excerpt, and seeds sample

import { BatsonRodBlanksSite } from '../../app/server/importer/sites/batson.rod-blanks'
import { renderHeadlessHtml } from '../../app/server/headless/renderHeadlessHtml'

const SOURCE = process.env.SOURCE_URL || 'https://batsonenterprises.com/rod-blanks'

async function fetchStaticHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function main() {
  const url = SOURCE
  const site = BatsonRodBlanksSite
  if (!site.match(url)) {
    console.error('URL does not match BatsonRodBlanksSite:', url)
    process.exit(2)
  }
  const staticHtml = await fetchStaticHtml(url)
  // Note: disable autoScroll to avoid TS helper serialization issues in page.evaluate during preflight
  const headlessHtml = await renderHeadlessHtml(url, { timeoutMs: 20000, autoScroll: false })

  let usedMode: 'static' | 'headless' | 'none' = 'none'
  let seeds: Array<{ url: string }> = []
  let debug: any = {}
  if (staticHtml && staticHtml.trim()) {
    const res = await site.discover(async m => (m === 'static' ? staticHtml : headlessHtml), url)
    usedMode = (res as any).usedMode || 'none'
    seeds = (res as any).seeds || []
    debug = (res as any).debug || {}
  } else if (headlessHtml && headlessHtml.trim()) {
    const res = await site.discover(async m => (m === 'static' ? null : headlessHtml), url)
    usedMode = (res as any).usedMode || 'none'
    seeds = (res as any).seeds || []
    debug = (res as any).debug || {}
  }

  const html = (usedMode === 'static' ? staticHtml : headlessHtml) || ''
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  const pageTitle = titleMatch ? titleMatch[1].trim() : ''
  const text = html.replace(/<[^>]+>/g, ' ')
  const contentLength = html.length
  const textLength = text.trim().length
  const htmlExcerpt = html.slice(0, 500)

  const out = {
    url,
    usedMode,
    contentLength,
    textLength,
    pageTitle,
    htmlExcerpt,
    seeds: seeds.slice(0, 10).map(s => s.url),
    debug,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
