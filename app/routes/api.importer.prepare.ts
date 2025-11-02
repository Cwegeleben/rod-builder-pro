import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

// Fire-and-forget prepare endpoint with quick validation.
// POST body: { templateId: string }
// Returns: { runId, candidates, etaSeconds }
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = typeof body.templateId === 'string' ? (body.templateId as string) : ''
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })

  const { prisma } = await import('../db.server')
  const { getTargetById } = await import('../server/importer/sites/targets')
  const { getSiteConfigForUrlDiscoverV1 } = await import('../server/importer/sites')
  const { renderHeadlessHtml } = await import('../server/headless/renderHeadlessHtml')

  // Load saved settings for this template
  const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
  if (!tpl) return json({ error: 'Template not found' }, { status: 404 })
  const cfg = (tpl.importConfig as Record<string, unknown>) || {}
  const settings = (cfg['settings'] as Record<string, unknown>) || {}
  const targetId = typeof settings['target'] === 'string' ? (settings['target'] as string) : ''
  const seedUrls: string[] = Array.isArray(settings['discoverSeedUrls'])
    ? (settings['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  if (!targetId || seedUrls.length === 0) {
    return json({ error: 'Missing target or seeds' }, { status: 400 })
  }

  const target = getTargetById(targetId)
  const supplierId = target?.siteId || targetId

  // Quick discover to validate and estimate scope
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }

  async function fetchStatic(url: string): Promise<string | null> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal })
      if (!r.ok) return null
      return await r.text()
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  const discovered = new Set<string>()
  for (const src of seedUrls.slice(0, 5)) {
    // cap initial validation to 5 seeds
    const site = getSiteConfigForUrlDiscoverV1(src)
    if (!site || typeof site.discover !== 'function') continue
    const baseUrl = (() => {
      try {
        const u = new URL(src)
        return `${u.protocol}//${u.hostname}`
      } catch {
        return src
      }
    })()
    let staticHtml: string | null = null
    try {
      staticHtml = await fetchStatic(src)
    } catch {
      /* ignore */
    }
    const fetchHtml: (mode: 'static' | 'headless') => Promise<string | null> = async (mode: 'static' | 'headless') => {
      if (mode === 'static') return staticHtml
      try {
        return await renderHeadlessHtml(src, { timeoutMs: 15_000 })
      } catch {
        return null
      }
    }
    try {
      const res = await site.discover(fetchHtml, baseUrl)
      const urls = Array.isArray(res.seeds) ? res.seeds.map((s: { url: string }) => s.url) : []
      for (const u of urls) discovered.add(u)
    } catch {
      /* continue */
    }
  }

  const candidates = discovered.size
  // ETA heuristic: requests per minute ~30, with per-product ~1.2x overhead and diffing constant
  const rpm = 30
  const seconds = Math.ceil((candidates / Math.max(1, rpm)) * 60 * 1.2 + 20)
  const etaSeconds = Math.min(60 * 20, Math.max(30, seconds)) // clamp 30s..20m

  // Prepare run and kick background job
  // Map target -> templateKey used by extractor so crawl matches Preview
  function templateKeyForTarget(id: string): string | undefined {
    if (/^batson-/.test(id)) return 'batson.product.v2'
    return undefined
  }
  const options = {
    mode: 'price_avail' as const,
    includeSeeds: true,
    manualUrls: seedUrls,
    skipSuccessful: false,
    notes: `prepare:${templateId}`,
    templateKey: templateKeyForTarget(targetId),
    variantTemplateId: undefined,
    scraperId: undefined,
  }

  const run = await prisma.importRun.create({
    data: {
      supplierId: supplierId || 'batson',
      status: 'preparing',
      summary: { preflight: { candidates, etaSeconds }, options } as unknown as object,
    },
  })

  // Log and start background job (fire-and-forget)
  await prisma.importLog.create({
    data: { templateId, runId: run.id, type: 'prepare:start', payload: { candidates, etaSeconds, options } },
  })
  // Persist preparing run on template for UI polling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: run.id } })
  // Additional preflight report log (sample up to 10 discovered URLs for quick debug)
  try {
    const sample = Array.from(discovered).slice(0, 10)
    await prisma.importLog.create({
      data: { templateId, runId: run.id, type: 'prepare:report', payload: { candidates, etaSeconds, sample } },
    })
  } catch {
    /* ignore */
  }

  import('../services/importer/runOptions.server').then(({ startImportFromOptions }) => {
    setTimeout(() => {
      startImportFromOptions(options, run.id)
        .then(async () => {
          await prisma.importRun.update({ where: { id: run.id }, data: { status: 'started' } })
          // Clear preparing run pointer
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
          await prisma.importLog.create({ data: { templateId, runId: run.id, type: 'prepare:done', payload: {} } })
        })
        .catch(async (err: unknown) => {
          await prisma.importRun.update({ where: { id: run.id }, data: { status: 'failed' } })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
          await prisma.importLog.create({
            data: {
              templateId,
              runId: run.id,
              type: 'prepare:error',
              payload: { message: (err as Error)?.message || 'unknown' },
            },
          })
        })
    }, 0)
  })

  return json({ runId: run.id, candidates, etaSeconds })
}

export default function ImporterPrepareApi() {
  return null
}
