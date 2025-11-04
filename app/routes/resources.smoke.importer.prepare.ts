import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'

// Smoke-only launcher for Save & Crawl without HQ auth. Use query params:
// - templateId: string (optional)
// - target: string (required if templateId missing)
// - seeds: comma-separated URLs (required if templateId missing)
// - notes: optional string
// Returns: { ok: true, runId, supplierId }
export async function loader({ request }: LoaderFunctionArgs) {
  try {
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
    // Ensure minimal importer tables exist before any reads/writes to avoid 500s on first run
    try {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS ImportRun (id TEXT PRIMARY KEY NOT NULL, supplierId TEXT NOT NULL, startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt DATETIME, status TEXT NOT NULL, progress TEXT, summary TEXT)',
      )
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportRun_supplier_idx ON ImportRun(supplierId)')
    } catch (e) {
      console.warn('[smoke:prepare] ensure ImportRun failed:', e)
    }
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

    if (!targetId || seedUrls.length === 0)
      return json({ ok: false, error: 'Missing target or seeds' }, { status: 400 })

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

    // Create run via raw SQL to avoid JSON conversion issues; summary will be filled later by pipeline
    const runId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
    await prisma.$executeRawUnsafe(
      'INSERT INTO ImportRun (id, supplierId, status) VALUES (?, ?, ?)',
      runId,
      supplierId,
      'preparing',
    )
    const run = { id: runId }

    if (templateId) {
      // Ensure ImportTemplate and ImportLog exist when template flow is used
      try {
        await prisma.$executeRawUnsafe(
          "CREATE TABLE IF NOT EXISTS ImportTemplate (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, importConfig TEXT NOT NULL DEFAULT '{}', state TEXT NOT NULL DEFAULT 'NEEDS_SETTINGS', lastRunAt DATETIME, hadFailures BOOLEAN NOT NULL DEFAULT 0, preparingRunId TEXT)",
        )
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportTemplate_state_idx ON ImportTemplate(state)')
        await prisma.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS ImportTemplate_preparing_idx ON ImportTemplate(preparingRunId)',
        )
        await prisma.$executeRawUnsafe(
          'CREATE TABLE IF NOT EXISTS ImportLog (id TEXT PRIMARY KEY NOT NULL, templateId TEXT NOT NULL, runId TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        )
        await prisma.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS ImportLog_tpl_run_type_idx ON ImportLog(templateId, runId, type)',
        )
      } catch (e) {
        console.warn('[smoke:prepare] ensure ImportTemplate/ImportLog failed:', e)
      }
      await prisma.importLog.create({
        data: { templateId, runId: run.id, type: 'prepare:start', payload: { options } },
      })
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
            if (templateId) {
              await prisma.$executeRawUnsafe(
                `UPDATE "ImportTemplate" SET "preparingRunId" = NULL WHERE "id" = ?`,
                templateId,
              )
              await prisma.importLog.create({ data: { templateId, runId: run.id, type: 'prepare:done', payload: {} } })
            }
          })
          .catch(async (err: unknown) => {
            try {
              await prisma.$executeRawUnsafe('UPDATE ImportRun SET status = ? WHERE id = ?', 'failed', run.id)
            } catch {
              // ignore
            }
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
  } catch (e) {
    const msg = (e as Error)?.message || 'Unexpected error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

// No default export to make this a proper resource route returning JSON
