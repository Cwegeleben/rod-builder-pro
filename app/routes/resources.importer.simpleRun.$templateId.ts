import { json, type LoaderFunctionArgs } from '@remix-run/node'

// Lightweight unauthenticated (token-gated) simple pipeline launcher for an ImportTemplate.
// Path: /resources/importer/simpleRun/:templateId?token=smoke-ok
// Returns { ok, runId, seeds } or { error }.
export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  if (token !== 'smoke-ok') return json({ error: 'unauthorized' }, { status: 401 })
  const templateId = String(params.templateId || '')
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })

  const { prisma } = await import('../db.server')

  try {
    const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
    if (!tpl) return json({ error: 'template not found' }, { status: 404 })
    // Parse saved settings seeds
    let manualUrls: string[] = []
    try {
      const cfg = tpl.importConfig as unknown as { settings?: { discoverSeedUrls?: string[]; target?: string } } | null
      manualUrls = Array.isArray(cfg?.settings?.discoverSeedUrls)
        ? (cfg!.settings!.discoverSeedUrls as string[]).filter(s => typeof s === 'string' && s.trim())
        : []
    } catch {
      manualUrls = []
    }
    if (!manualUrls.length) return json({ error: 'no seeds saved' }, { status: 422 })

    // Derive supplierId and targetId from saved settings (align with api.importer.run detection)
    let supplierId = 'batson'
    let targetId = ''
    try {
      const cfg = tpl.importConfig as unknown as { settings?: { target?: string } } | null
      targetId = cfg?.settings?.target || ''
      if (targetId) {
        const { getTargetById } = await import('../server/importer/sites/targets')
        const t = getTargetById(targetId)
        supplierId = (t?.siteId as string) || targetId || supplierId
      }
    } catch {
      /* ignore */
    }

    // Ensure no active run occupying the slot
    if (tpl.preparingRunId) {
      const active = await prisma.importRun.findUnique({ where: { id: tpl.preparingRunId } })
      if (active && !active.finishedAt && !['staged', 'failed', 'cancelled', 'success'].includes(active.status)) {
        return json({ error: 'run already active', runId: active.id }, { status: 409 })
      }
    }

    const { startImportFromOptions } = await import('../services/importer/runOptions.server')
    // Enable series parser automatically for Reel Seats targets to match unified run API behavior
    const useSeriesParser = /reel/i.test(supplierId) || /reel/i.test(targetId)
    const options = {
      mode: 'discover' as const,
      includeSeeds: true,
      manualUrls,
      skipSuccessful: false,
      notes: `prepare:${templateId}`,
      supplierId,
      templateId,
      templateKey: undefined,
      variantTemplateId: undefined,
      scraperId: undefined,
      useSeriesParser,
      pipeline: 'simple' as const,
      includeSeedsOnly: true,
      limit: undefined,
    }

    // Create the ImportRun first and occupy the template slot to prevent double-starts
    const run = await prisma.importRun.create({
      data: {
        supplierId,
        status: 'started',
        summary: { options } as unknown as object,
      },
      select: { id: true },
    })
    try {
      await prisma.importTemplate.update({ where: { id: templateId }, data: { preparingRunId: run.id } })
    } catch {
      /* ignore */
    }

    // Fire-and-forget the actual work so the HTTP call returns immediately with runId
    setTimeout(() => {
      startImportFromOptions(options, run.id).catch(async (e: unknown) => {
        try {
          await prisma.importRun.update({ where: { id: run.id }, data: { status: 'failed' } })
        } catch {
          /* ignore */
        }
        try {
          await prisma.importLog.create({
            data: {
              templateId,
              runId: run.id,
              type: 'simple:error',
              payload: { message: (e as Error)?.message || 'unknown' },
            },
          })
        } catch {
          /* ignore */
        }
        try {
          await prisma.importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
        } catch {
          /* ignore */
        }
      })
    }, 0)

    return json({ ok: true, runId: run.id, seeds: manualUrls.length })
  } catch (e) {
    return json({ error: (e as Error)?.message || 'launch failed' }, { status: 500 })
  }
}

export default function ImporterSimpleRunTemplate() {
  return null
}
