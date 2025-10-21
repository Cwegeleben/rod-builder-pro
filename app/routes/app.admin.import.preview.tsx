// hq-run-options-scrape-preview-v1
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { chromium } from 'playwright'
import { extractProduct } from '../../packages/importer/src/extractors/batson.parse'

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  let urls: string[] = []
  const ct = request.headers.get('content-type') || ''
  if (/application\/json/i.test(ct)) {
    const body = await request.json().catch(() => null)
    urls = Array.isArray(body?.urls) ? (body.urls as string[]) : []
  } else {
    const fd = await request.formData().catch(() => null)
    const raw = fd?.get('urls')?.toString() || '[]'
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) urls = arr as string[]
    } catch {
      urls = []
    }
  }
  if (!urls.length) return json({ results: [] })

  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
  const context = await browser.newContext()
  const page = await context.newPage()
  const results: Array<{
    url: string
    externalId: string | null
    title: string | null
    images: string[]
    ok: boolean
    error?: string
  }> = []
  for (const u of urls.slice(0, 20)) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      const rec = await extractProduct(page)
      results.push({
        url: u,
        externalId: rec?.externalId || null,
        title: rec?.title || null,
        images: rec?.images?.slice(0, 6) || [],
        ok: Boolean(rec && rec.externalId),
      })
    } catch (e) {
      results.push({ url: u, externalId: null, title: null, images: [], ok: false, error: (e as Error).message })
    }
  }
  await browser.close().catch(() => {})
  return json({ results })
}

export default function PreviewEndpoint() {
  return null
}
