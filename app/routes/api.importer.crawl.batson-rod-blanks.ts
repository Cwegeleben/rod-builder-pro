import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { discoverBatsonRodBlanksAllPages } from '../server/importer/crawlers/batsonSeries'

// POST /api/importer/crawl/batson-rod-blanks
// Body: { startUrl?: string, maxPages?: number }
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const base = 'https://batsonenterprises.com'
  const canonicalPath = '/rod-blanks'
  const canonical = `${base}${canonicalPath}`
  type Body = { startUrl?: string; maxPages?: number }
  const raw = (await request.json().catch(() => ({}))) as unknown
  const body: Body = raw && typeof raw === 'object' ? (raw as Body) : {}
  let url = canonical
  const inputStartUrl = typeof body.startUrl === 'string' ? body.startUrl : undefined
  const maxPages = typeof body.maxPages === 'number' ? body.maxPages : undefined
  if (inputStartUrl) {
    try {
      const u = new URL(inputStartUrl)
      if (u.hostname !== 'batsonenterprises.com' || !u.pathname.startsWith(canonicalPath)) {
        return json({ urls: [], count: 0, debug: { reason: 'Off-canonical startUrl' } }, { status: 400 })
      }
      url = u.toString()
    } catch {
      return json({ urls: [], count: 0, debug: { reason: 'Invalid startUrl' } }, { status: 400 })
    }
  }
  const res = await discoverBatsonRodBlanksAllPages(url, { maxPages })
  return json({ urls: res.urls, count: res.urls.length, debug: res.debug })
}

export default function ApiImporterCrawlBatsonRodBlanks() {
  return null
}
