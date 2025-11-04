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
  const confirmOverwrite = Boolean(body.confirmOverwrite) || /\bconfirm(=|:)?(1|true|yes)\b/i.test(JSON.stringify(body))
  const overwriteExisting = Boolean(body.overwriteExisting) || false
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })

  const { prisma } = await import('../db.server')
  const { getTargetById } = await import('../server/importer/sites/targets')
  const { getSiteConfigForUrlDiscoverV1 } = await import('../server/importer/sites')
  const { renderHeadlessHtml } = await import('../server/headless/renderHeadlessHtml')
  const { PRODUCT_MODELS } = await import('../server/importer/products/models')

  // Load saved settings for this template
  const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
  if (!tpl) return json({ error: 'Template not found' }, { status: 404 })
  const cfg = (tpl.importConfig as Record<string, unknown>) || {}
  const settings = (cfg['settings'] as Record<string, unknown>) || {}
  const targetId = typeof settings['target'] === 'string' ? (settings['target'] as string) : ''
  const rawSeeds: string[] = Array.isArray(settings['discoverSeedUrls'])
    ? (settings['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  // Normalize/validate seeds: absolute HTTPS urls only
  const seedUrls: string[] = rawSeeds
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      try {
        const u = new URL(s)
        if (!u.protocol.startsWith('http')) return ''
        // force https
        u.protocol = 'https:'
        return u.toString()
      } catch {
        return ''
      }
    })
    .filter(Boolean)
  if (!targetId || seedUrls.length === 0) {
    return json({ error: 'Missing target or seeds' }, { status: 400 })
  }

  const target = getTargetById(targetId)
  const supplierId = target?.siteId || targetId

  // If this prepare would overwrite existing staged data for the supplier, prompt for confirmation
  try {
    const stagedCount = await (await import('../db.server')).prisma.partStaging.count({ where: { supplierId } })
    if (stagedCount > 0 && !confirmOverwrite) {
      return json(
        {
          ok: false,
          code: 'confirm_overwrite',
          supplierId,
          stagedCount,
          message:
            'This action will overwrite existing staged items for this supplier. Re-run with confirmOverwrite to proceed.',
        },
        { status: 409 },
      )
    }
  } catch {
    /* ignore confirm probe errors */
  }

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
    const timer = setTimeout(() => ctrl.abort(), 15_000)
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
        return await renderHeadlessHtml(src, { timeoutMs: 20_000 })
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
  // Optional quick estimate: for series-parser targets, count expected item rows per seed.
  let expectedItems: number | undefined = undefined
  try {
    if (useSeriesParserForTarget(targetId)) {
      const parse = PRODUCT_MODELS['batson-attribute-grid']
      let total = 0
      // Compute base once
      const getBase = (u: string) => {
        try {
          const x = new URL(u)
          return `${x.protocol}//${x.hostname}`
        } catch {
          return 'https://batsonenterprises.com'
        }
      }
      for (const seed of seedUrls) {
        let html: string | null = null
        try {
          html = await fetchStatic(seed)
        } catch {
          html = null
        }
        if (!html) {
          try {
            html = await renderHeadlessHtml(seed, { timeoutMs: 20_000 })
          } catch {
            html = null
          }
        }
        if (!html) continue
        try {
          const base = getBase(seed)
          const res = parse(html, base)
          total += Array.isArray(res?.rows) ? res.rows.length : 0
        } catch {
          /* ignore bad page */
        }
      }
      expectedItems = total
    }
  } catch {
    /* ignore estimate errors */
  }
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
  function useSeriesParserForTarget(id: string): boolean {
    // Enable parser-driven staging for Batson Rod Blanks target only
    return id === 'batson-rod-blanks'
  }
  // Sanitize options for JSON storage (strip undefined)
  const optsRaw = {
    mode: 'discover' as const,
    includeSeeds: true,
    manualUrls: seedUrls,
    skipSuccessful: false,
    notes: `prepare:${templateId}`,
    supplierId: supplierId || 'batson',
    templateKey: templateKeyForTarget(targetId),
    variantTemplateId: undefined,
    scraperId: undefined,
    useSeriesParser: useSeriesParserForTarget(targetId),
  }
  const options = Object.fromEntries(Object.entries(optsRaw).filter(([, v]) => v !== undefined)) as typeof optsRaw

  // Create the run first without progress to avoid runtime errors on environments lacking the column
  const run = await prisma.importRun.create({
    data: {
      supplierId: supplierId || 'batson',
      status: 'preparing',
      summary: { preflight: { candidates, etaSeconds, expectedItems }, options } as unknown as object,
    },
  })
  // Best-effort set initial progress (ignore if column missing)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).importRun.update({
      where: { id: run.id },
      data: { progress: { phase: 'preparing', percent: 0, etaSeconds, details: { candidates, expectedItems } } },
    })
  } catch {
    /* ignore */
  }

  // Log and start background job (fire-and-forget)
  await prisma.importLog.create({
    data: {
      templateId,
      runId: run.id,
      type: 'prepare:start',
      payload: { candidates, etaSeconds, expectedItems, options },
    },
  })
  // Persist preparing run on template for UI polling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: run.id } })
  // Additional preflight report log (sample up to 10 discovered URLs for quick debug)
  try {
    const sample = Array.from(discovered).slice(0, 10)
    await prisma.importLog.create({
      data: {
        templateId,
        runId: run.id,
        type: 'prepare:report',
        payload: { candidates, etaSeconds, expectedItems, sample },
      },
    })
  } catch {
    /* ignore */
  }

  import('../services/importer/orchestrator.server').then(async ({ runPrepareJob }) => {
    setTimeout(() => {
      ;(async () => {
        if (confirmOverwrite && overwriteExisting) {
          // Optional wipe of existing staged rows to ensure a clean slate (best-effort)
          try {
            await prisma.partStaging.deleteMany({ where: { supplierId } })
          } catch {
            /* ignore */
          }
        }
        await runPrepareJob({ templateId, options, runId: run.id })
      })()
        .then(async () => {
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

  return json({ runId: run.id, candidates, etaSeconds, expectedItems })
}

export default function ImporterPrepareApi() {
  return null
}
