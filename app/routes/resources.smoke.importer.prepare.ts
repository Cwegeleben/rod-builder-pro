import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'

// Smoke-only launcher for Save & Crawl without HQ auth. Use query params:
// - templateId: string (optional)
// - target: string (required if templateId missing)
// - seeds: comma-separated URLs (required if templateId missing)
// - notes: optional string
// Returns: { ok: true, runId, supplierId }
export async function loader({ request }: LoaderFunctionArgs) {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const templateId = url.searchParams.get('templateId') || ''
  const explicitTarget = url.searchParams.get('target') || ''
  const explicitSeeds = (url.searchParams.get('seeds') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const notes = url.searchParams.get('notes') || 'smoke:prepare'

  const { prisma } = await import('../db.server')
  const { getTargetById } = await import('../server/importer/sites/targets')

  let targetId = explicitTarget
  let seedUrls: string[] = explicitSeeds
  if (templateId) {
    // Accessing dynamic table not present in generated Prisma client types; use $queryRawUnsafe to avoid 'any'.
    const tplRows = (await prisma.$queryRawUnsafe(
      `SELECT id, importConfig FROM ImportTemplate WHERE id = ? LIMIT 1`,
      templateId,
    )) as Array<{ id: string; importConfig: unknown }>
    const tpl = tplRows[0]
    if (!tpl) return json({ ok: false, error: 'Template not found' }, { status: 404 })
    try {
      const cfg = (tpl?.importConfig as Record<string, unknown>) || {}
      const settings = (cfg['settings'] as Record<string, unknown>) || {}
      targetId = (settings['target'] as string) || targetId
      seedUrls = Array.isArray(settings['discoverSeedUrls'])
        ? (settings['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
        : seedUrls
    } catch {
      /* ignore */
    }
  }

  if (!targetId || seedUrls.length === 0) return json({ ok: false, error: 'Missing target or seeds' }, { status: 400 })

  const target = getTargetById(targetId)
  const supplierId = (target?.siteId as string) || targetId

  function templateKeyForTarget(id: string): string | undefined {
    if (/^batson-/.test(id)) return 'batson.product.v2'
    return undefined
  }
  function useSeriesParserForTarget(id: string): boolean {
    return id === 'batson-rod-blanks'
  }

  const options = {
    mode: 'discover' as const,
    includeSeeds: true,
    manualUrls: seedUrls,
    skipSuccessful: false,
    notes,
    supplierId,
    templateKey: templateKeyForTarget(targetId),
    variantTemplateId: undefined,
    scraperId: undefined,
    useSeriesParser: useSeriesParserForTarget(targetId),
  }

  const run = await prisma.importRun.create({
    data: {
      supplierId,
      status: 'preparing',
      summary: { preflight: null, options } as unknown as object,
    },
  })

  if (templateId) {
    await prisma.importLog.create({ data: { templateId, runId: run.id, type: 'prepare:start', payload: { options } } })
    // Update ImportTemplate.preparingRunId via raw to avoid any-casts
    await prisma.$executeRawUnsafe(
      `UPDATE "ImportTemplate" SET "preparingRunId" = ? WHERE "id" = ?`,
      run.id,
      templateId,
    )
  }

  import('../services/importer/runOptions.server').then(({ startImportFromOptions }) => {
    setTimeout(() => {
      startImportFromOptions(options, run.id)
        .then(async () => {
          // Let startImportFromOptions manage the run status (it sets 'staged' after diffs).
          // Avoid downgrading status back to 'started' here.
          if (templateId) {
            await prisma.$executeRawUnsafe(
              `UPDATE "ImportTemplate" SET "preparingRunId" = NULL WHERE "id" = ?`,
              templateId,
            )
            await prisma.importLog.create({ data: { templateId, runId: run.id, type: 'prepare:done', payload: {} } })
          }
        })
        .catch(async (err: unknown) => {
          await prisma.importRun.update({ where: { id: run.id }, data: { status: 'failed' } })
          if (templateId) {
            await prisma.$executeRawUnsafe(
              `UPDATE "ImportTemplate" SET "preparingRunId" = NULL WHERE "id" = ?`,
              templateId,
            )
            await prisma.importLog.create({
              data: {
                templateId,
                runId: run.id,
                type: 'prepare:error',
                payload: { message: (err as Error)?.message || 'unknown' },
              },
            })
          }
        })
    }, 0)
  })

  return json({ ok: true, runId: run.id, supplierId })
}

export default function ImporterPrepareSmoke() {
  return null
}
