// Unified sequential crawl launcher (new API)
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

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

  const approveAdds = Boolean(body.approveAdds)
  const doPublish = Boolean(body.publish)
  const dryRun = Boolean(body.dryRun)

  const { prisma } = await import('../db.server')

  // Block if an active prepare/crawl is already associated with this template
  try {
    const tpl = await prisma.importTemplate.findUnique({
      where: { id: templateId },
      select: { preparingRunId: true, importConfig: true },
    })
    if (tpl?.preparingRunId) {
      return json(
        {
          error: 'A crawl is already in progress for this template',
          code: 'blocked_prepare',
          hint: 'Cancel the active run before starting a new one.',
        },
        { status: 409 },
      )
    }

    // Resolve supplierId from target (importConfig.settings.target)
    const cfg = (tpl?.importConfig as Record<string, unknown> | null) || null
    const settings = (cfg?.['settings'] as Record<string, unknown> | null) || null
    const targetId = typeof settings?.['target'] === 'string' ? (settings['target'] as string) : ''
    let supplierId = ''
    if (targetId) {
      try {
        const { getTargetById } = await import('../server/importer/sites/targets')
        const t = getTargetById(targetId)
        supplierId = (t?.siteId as string) || targetId
      } catch {
        supplierId = targetId
      }
    }

    // Compose manualUrls from saved settings seeds
    const manualUrls = Array.isArray(settings?.['discoverSeedUrls'])
      ? (settings!['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : []

    const { startImportFromOptions } = await import('../services/importer/runOptions.server')
    const options = {
      mode: 'discover' as const,
      includeSeeds: false, // rely on manualUrls for full determinism
      manualUrls,
      skipSuccessful: false,
      notes: `prepare:${templateId}`,
      supplierId: supplierId || 'batson',
      templateId,
      templateKey: undefined,
      variantTemplateId: undefined,
      scraperId: undefined,
      useSeriesParser: false,
    }

    const runId = await startImportFromOptions(options)

    // Mark template as preparing with this run id
    try {
      await prisma.importTemplate.update({ where: { id: templateId }, data: { preparingRunId: runId } })
    } catch {
      /* ignore */
    }

    return json({ ok: true, runId, queued: false, approveAdds, publish: doPublish, dryRun })
  } catch (e) {
    const msg = (e as Error)?.message || 'Failed to start crawl'
    return json({ error: msg }, { status: 500 })
  }
}

export default function StartRunApi() {
  return null
}
