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
  const autoConfirm = Boolean((body as Record<string, unknown>)['autoConfirm']) || false
  const stagedCountHint =
    typeof (body as Record<string, unknown>)['stagedCountHint'] === 'number'
      ? Number((body as Record<string, unknown>)['stagedCountHint'])
      : undefined
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
      // First attempt: full create including summary (for modern schemas)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (prisma as any).importRun.create({ data })
    } catch {
      // Second attempt: omit JSON fields like summary/progress
      const fallback = { supplierId: data.supplierId, status: data.status }
      try {
        return await prisma.importRun.create({ data: fallback })
      } catch {
        // Final attempt: raw SQL insert with minimal columns to bypass Prisma JSON mapping issues
        try {
          const { randomUUID } = await import('node:crypto')
          const id = randomUUID()
          const startedAt = new Date().toISOString()
          // Use quoted identifiers to avoid case issues; SQLite is case-insensitive for table/columns
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).$executeRawUnsafe(
            'INSERT INTO "ImportRun" ("id", "supplierId", "status", "startedAt") VALUES (?, ?, ?, ?)',
            id,
            data.supplierId,
            data.status,
            startedAt,
          )
          // Return a minimal object with id; callers must not rely on other fields
          return { id, supplierId: data.supplierId, status: data.status } as unknown as {
            id: string
            supplierId: string
            status: string
          }
        } catch {
          // Re-throw the original error path if raw also fails
          throw new Error('importRun.create failed (JSON unsupported and raw insert failed)')
        }
      }
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
  const savedSeedHash =
    typeof (settings as Record<string, unknown>)['seedHash'] === 'string'
      ? String((settings as Record<string, unknown>)['seedHash'])
      : ''
  const lastPrepareSeedHash =
    typeof (settings as Record<string, unknown>)['lastPrepareSeedHash'] === 'string'
      ? String((settings as Record<string, unknown>)['lastPrepareSeedHash'])
      : ''
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

  // Compute deterministic seed hash if not present (backfill for legacy rows)
  function normalizeSeedsForHash(urls: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of urls) {
      const s = String(raw || '').trim()
      if (!s) continue
      try {
        const u = new URL(s)
        if (!/^https?:$/.test(u.protocol)) continue
        u.protocol = 'https:'
        const k = u.toString()
        if (!seen.has(k)) {
          seen.add(k)
          out.push(k)
        }
      } catch {
        // skip invalid
      }
    }
    return out.sort()
  }
  async function sha256Hex(input: string): Promise<string> {
    try {
      const { createHash } = await import('node:crypto')
      const h = createHash('sha256')
      h.update(input)
      return h.digest('hex')
    } catch {
      // Fallback: simple JSON length fingerprint (non-cryptographic)
      return String(input.length)
    }
  }
  const seedHash = savedSeedHash || (await sha256Hex(JSON.stringify(normalizeSeedsForHash(seedUrls))))
  const seedChanged = !!(lastPrepareSeedHash && lastPrepareSeedHash !== seedHash)

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
    let stagedCount = 0
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stagedCount = await (await import('../db.server')).prisma.partStaging.count({ where: { supplierId } } as any)
    } catch {
      stagedCount = 0
    }
    // When seeds changed since last prepare, auto-allow overwrite (we'll perform a best-effort wipe below)
    if (stagedCount > 0 && !confirmOverwrite && !seedChanged) {
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
    templateId,
    variantTemplateId: undefined,
    scraperId: undefined,
    useSeriesParser: useSeriesParserForTarget(targetId),
    seedHash,
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
  // Telemetry: if client indicated autoConfirm heuristic was used, log once with hint
  if (autoConfirm) {
    try {
      await prisma.importLog.create({
        data: {
          templateId,
          runId: run.id,
          type: 'prepare:autoConfirm',
          payload: { stagedCountHint },
        },
      })
    } catch {
      /* ignore telemetry logging errors */
    }
  }
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
          payload: { candidates, etaSeconds, expectedItems, sample, seedHash, seedChanged, lastPrepareSeedHash },
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
        // Best-effort auto-wipe when explicitly requested OR when seeds changed
        if ((confirmOverwrite && overwriteExisting) || seedChanged) {
          // Optional wipe of existing staged rows to ensure a clean slate (best-effort)
          try {
            let before = 0
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              before = await prisma.partStaging.count({ where: { supplierId } } as any)
            } catch {
              before = 0
            }
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await prisma.partStaging.deleteMany({ where: { supplierId } } as any)
            } catch {
              /* ignore */
            }
            // Also clear ProductSource rows scoped to this template/supplier to avoid reusing stale seeds
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const whereScope: any = templateId ? { supplierId, templateId } : { supplierId }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (prisma as any).productSource.deleteMany({ where: whereScope })
            } catch {
              /* ignore */
            }
            try {
              await prisma.importLog.create({
                data: {
                  templateId,
                  runId: run.id,
                  type: seedChanged ? 'prepare:autowipe:seedChanged' : 'prepare:autowipe:forced',
                  payload: { deleted: before, reason: seedChanged ? 'seedChanged' : 'forced', clearedSources: true },
                },
              })
            } catch {
              /* ignore */
            }
          } catch {
            /* ignore */
          }
        }
        await runPrepareJob({ templateId, options, runId: run.id })
      })()
        .then(async () => {
          // Clear preparing run pointer
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
          } catch {
            /* ignore */
          }
          // Persist lastPrepareSeedHash back to template settings for future comparisons
          try {
            const row = await prisma.importTemplate.findUnique({ where: { id: templateId } })
            const cfg0 = (row?.importConfig as Record<string, unknown> | null) || {}
            const s0 = (cfg0['settings'] as Record<string, unknown> | null) || {}
            const next = { ...cfg0, settings: { ...s0, lastPrepareSeedHash: seedHash } }
            await prisma.importTemplate.update({ where: { id: templateId }, data: { importConfig: next } })
            try {
              await prisma.importLog.create({
                data: { templateId, runId: run.id, type: 'prepare:seedHash.saved', payload: { seedHash } },
              })
            } catch {
              /* ignore */
            }
          } catch {
            /* ignore */
          }
          // Best-effort consistency report
          try {
            let stagedCount = 0
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              stagedCount = await prisma.partStaging.count({ where: { supplierId } } as any)
            } catch {
              stagedCount = 0
            }
            const diffCount = await prisma.importDiff.count({ where: { importRunId: run.id } })
            await prisma.importLog.create({
              data: {
                templateId,
                runId: run.id,
                type: 'prepare:consistency',
                payload: { stagedCount, diffCount, candidates, seedHash },
              },
            })
          } catch {
            /* ignore */
          }
          try {
            await prisma.importLog.create({ data: { templateId, runId: run.id, type: 'prepare:done', payload: {} } })
          } catch {
            /* ignore */
          }
          // Kick next queued run for this template, if any
          try {
            await startNextQueuedForTemplate(templateId)
          } catch {
            /* ignore */
          }
        })
        .catch(async (err: unknown) => {
          // Best-effort: mark run failed; tolerate missing/unsupported columns
          try {
            await prisma.importRun.update({ where: { id: run.id }, data: { status: 'failed' } })
          } catch {
            /* ignore */
          }
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
