// Dump all discovered seeds for Batson Guides & Tip Tops as JSON
import { renderHeadlessHtml } from '../../app/server/headless/renderHeadlessHtml'
import { getDiscoverSiteById } from '../../app/server/importer/sites'

type StaticRes = { status: number; contentLength: number; html: string }
async function fetchStaticHtml(url: string): Promise<StaticRes> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
  } as const
  const res = await fetch(url, { method: 'GET', redirect: 'follow', headers })
  const buf = await res.arrayBuffer()
  const html = new TextDecoder('utf-8').decode(buf)
  return { status: res.status, contentLength: buf.byteLength, html }
}

async function main() {
  const SOURCE_URL = process.env.SOURCE_URL || 'https://batsonenterprises.com/guides-tip-tops'
  const site = getDiscoverSiteById('batson-guides-tops')
  if (!site?.discover) {
    console.error('[dump-guides-seeds] site discover not available')
    process.exit(2)
  }
  const s = await fetchStaticHtml(SOURCE_URL)
  const res = await site.discover!(async (mode: 'static' | 'headless') => {
    if (mode === 'static') return s.html ?? null
    return renderHeadlessHtml(SOURCE_URL, {
      waitUntil: 'networkidle',
      afterNavigateDelayMs: 400,
      autoScroll: true,
      timeoutMs: 15000,
    })
  }, SOURCE_URL)
  const seeds = (res?.seeds || []).map(s => s.url).filter(Boolean)
  console.log(JSON.stringify({ ok: true, total: seeds.length, seeds }, null, 2))
}

main().catch(e => {
  console.error('[dump-guides-seeds] fatal', e)
  process.exit(1)
})
