import { json, type ActionFunctionArgs } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'

// POST /resources/debug/ps/bulk-seed?supplierId=<slug>
// Body can be JSON { urls: string[] } or form-encoded urls=... (newline/comma separated)
export async function action({ request }: ActionFunctionArgs) {
  const urlObj = new URL(request.url)
  const supplierSlug = urlObj.searchParams.get('supplierId') || 'batson-reel-seats'
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'not-authorized' }, { status: 404 })

  const ct = request.headers.get('content-type') || ''
  let urls: string[] = []
  try {
    if (/application\/json/i.test(ct)) {
      const body = (await request.json().catch(() => ({}))) as { urls?: unknown }
      const raw = Array.isArray(body.urls) ? (body.urls as unknown[]) : []
      urls = raw.map(x => String(x || '').trim()).filter(Boolean)
    } else {
      const fd = await request.formData()
      const s = String(fd.get('urls') || '').trim()
      if (s)
        urls = s
          .split(/[\n,]+/)
          .map(t => t.trim())
          .filter(Boolean)
      const singles = fd
        .getAll('url')
        .map(x => String(x || '').trim())
        .filter(Boolean)
      if (singles.length) urls.push(...singles)
    }
  } catch {
    /* ignore */
  }
  urls = Array.from(new Set(urls))
  if (!urls.length) return json({ error: 'no urls provided' }, { status: 400 })

  const { upsertProductSource } = await import('../../packages/importer/src/seeds/sources')
  const results: Array<{ url: string; ok: boolean }> = []
  for (const u of urls) {
    try {
      await upsertProductSource(supplierSlug, u, 'forced', 'debug:bulk-seed', undefined)
      results.push({ url: u, ok: true })
    } catch {
      results.push({ url: u, ok: false })
    }
  }
  return json({
    ok: true,
    supplierId: supplierSlug,
    count: results.filter(r => r.ok).length,
    total: results.length,
    results,
  })
}

export default function DebugPsBulkSeed() {
  return null
}
