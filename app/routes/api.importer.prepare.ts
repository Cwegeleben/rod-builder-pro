import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

// Fire-and-forget prepare endpoint with quick validation.
// POST body: { templateId: string }
// Returns: { runId, candidates, etaSeconds }
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  // Feature flag: allow disabling background prepare in selected environments
  // IMPORTER_BG_ENABLED=0 → returns 503 with a clear message
  try {
    const enabled = String(process.env.IMPORTER_BG_ENABLED ?? '1') !== '0'
    if (!enabled) {
      return json(
        { ok: false, code: 'disabled', error: 'Background prepare is temporarily disabled in this environment.' },
        { status: 503 },
      )
    }
  } catch {
    // ignore env read issues
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = typeof body.templateId === 'string' ? (body.templateId as string) : ''
  const confirmOverwrite = Boolean(body.confirmOverwrite) || /\bconfirm(=|:)?(1|true|yes)\b/i.test(JSON.stringify(body))
  const overwriteExisting = Boolean(body.overwriteExisting) || false
  const skipSuccessful = Boolean(body.skipSuccessful)
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })

  const { prisma } = await import('../db.server')
  const { getTargetById } = await import('../server/importer/sites/targets')

  // Helper: create ImportRun defensively in environments where JSON columns may not exist yet
  async function createImportRunSafe(data: {
    supplierId: string
    status: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summary?: any
  }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (prisma as any).importRun.create({ data })
    } catch {
      // Retry without summary to tolerate older schemas without the column
      const fallback = { supplierId: data.supplierId, status: data.status }
      return await prisma.importRun.create({ data: fallback })
    }
  }

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

  // Enforce seed scope for selected targets (e.g., Batson-only)
  try {
    const { allowedHostsForTarget, partitionUrlsByHost } = await import('../server/importer/seedScope.server')
    const allowed = allowedHostsForTarget(targetId)
    if (allowed.length) {
      const { invalid, invalidHosts } = partitionUrlsByHost(seedUrls, allowed)
      if (invalid.length) {
        return json(
          {
            ok: false,
            code: 'seed_scope_violation',
            error: `Some seeds are outside the allowed domain(s): ${allowed.join(', ')}`,
            allowedHosts: allowed,
            invalidUrls: invalid,
            seenHosts: invalidHosts,
          },
          { status: 400 },
        )
      }
    }
  } catch {
    // non-fatal
  }

  const target = getTargetById(targetId)
  const supplierId = target?.siteId || targetId

  // We will compute preflight first, then decide whether to queue or start immediately

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

  // Fast preflight to keep TTFB low in embedded Admin:
  // Avoid external network fetches in the action handler. Use seed count as a proxy for candidates.
  const candidates = seedUrls.length
  const expectedItems: number | undefined = undefined
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
    skipSuccessful,
    notes: `prepare:${templateId}`,
    supplierId: supplierId || 'batson',
    templateKey: templateKeyForTarget(targetId),
    variantTemplateId: undefined,
    scraperId: undefined,
    useSeriesParser: useSeriesParserForTarget(targetId),
  }
  const options = Object.fromEntries(Object.entries(optsRaw).filter(([, v]) => v !== undefined)) as typeof optsRaw

  // If an active prepare is already running for this template, enqueue a queued run and return 202
  try {
    const tpl2 = await prisma.importTemplate.findUnique({ where: { id: templateId } })
    const existingRunId = (tpl2 as unknown as { preparingRunId?: string | null })?.preparingRunId
    if (existingRunId) {
      // Create a queued run with the same preflight snapshot and options
      const queued = await createImportRunSafe({
        supplierId: supplierId || 'batson',
        status: 'queued',
        summary: { preflight: { candidates, etaSeconds, expectedItems }, options },
      })
      try {
        await prisma.importLog.create({
          data: {
            templateId,
            runId: queued.id,
            type: 'prepare:queued',
            payload: { candidates, etaSeconds, expectedItems },
          },
        })
      } catch {
        /* ignore logging errors (table may be missing) */
      }
      return json({ ok: true, queued: true, runId: queued.id, candidates, etaSeconds, expectedItems }, { status: 202 })
    }
  } catch {
    /* ignore and fall back to immediate start */
  }

  // Create the run first without progress to avoid runtime errors on environments lacking the column
  const run = await createImportRunSafe({
    supplierId: supplierId || 'batson',
    status: 'preparing',
    summary: { preflight: { candidates, etaSeconds, expectedItems }, options },
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
  try {
    await prisma.importLog.create({
      data: {
        templateId,
        runId: run.id,
        type: 'prepare:start',
        payload: { candidates, etaSeconds, expectedItems, options },
      },
    })
  } catch {
    /* ignore logging errors */
  }
  // Persist preparing run on template for UI polling
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: run.id } })
  } catch {
    /* ignore missing column/table */
  }
  // Additional preflight report log (sample seeds; discovery moved to background)
  try {
    const sample = seedUrls.slice(0, 10)
    try {
      await prisma.importLog.create({
        data: {
          templateId,
          runId: run.id,
          type: 'prepare:report',
          payload: { candidates, etaSeconds, expectedItems, sample },
        },
      })
    } catch {
      /* ignore logging errors */
    }
  } catch {
    /* ignore */
  }

  import('../services/importer/orchestrator.server').then(async ({ runPrepareJob, startNextQueuedForTemplate }) => {
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
          // Kick next queued run for this template, if any
          try {
            await startNextQueuedForTemplate(templateId)
          } catch {
            /* ignore */
          }
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
          // Attempt to start next queued even after a failure
          try {
            await startNextQueuedForTemplate(templateId)
          } catch {
            /* ignore */
          }
        })
    }, 0)
  })

  return json({ runId: run.id, candidates, etaSeconds, expectedItems })
}

export default function ImporterPrepareApi() {
  return null
}
