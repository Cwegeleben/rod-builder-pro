// <!-- BEGIN RBP GENERATED: importer-delete-templates-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma as prismaDirect } from '../db.server'

// Delete one or more ImportTemplate rows and related artifacts.
// Input (JSON or form): { templateIds: string[] } or repeated templateId fields
// Behavior:
// - Deletes ImportTemplate rows by id
// - Cascades ImportLog via FK
// - Best-effort cleanup by supplierId (derived from template importConfig.settings.target):
//   - PartStaging, ProductSource
//   - ImportRun + ImportDiff for the supplier
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)

  const ct = request.headers.get('content-type') || ''
  const read = async () => {
    if (/application\/json/i.test(ct)) return (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fd = await request.formData().catch(() => null)
    const arr: string[] = []
    if (fd) {
      const values = fd.getAll('templateId')
      for (const v of values) {
        const s = String(v || '').trim()
        if (s) arr.push(s)
      }
    }
    return { templateIds: arr }
  }

  const url = new URL(request.url)
  const body = (await read()) as { templateIds?: unknown; dryRun?: unknown }
  const templateIds = Array.isArray(body.templateIds)
    ? (body.templateIds as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  if (templateIds.length === 0) return json({ error: 'Missing templateIds' }, { status: 400 })
  const dryRun = url.searchParams.get('dry') === '1' || url.searchParams.get('dryRun') === '1' || Boolean(body?.dryRun)

  const prisma = prismaDirect
  const { getTargetById } = await import('../server/importer/sites/targets')

  // Collect supplierIds to clean up by reading importConfig
  const rows = await (prisma as any).importTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, importConfig: true },
  })

  const supplierIds = new Set<string>()
  for (const r of rows as Array<{ id: string; importConfig: unknown }>) {
    try {
      const cfg = (r.importConfig as Record<string, unknown>) || {}
      const settings = (cfg['settings'] as Record<string, unknown>) || {}
      const targetId = typeof settings['target'] === 'string' ? (settings['target'] as string) : ''
      if (targetId) {
        const t = getTargetById(targetId)
        const sid = (t?.siteId as string) || targetId
        if (sid) supplierIds.add(sid)
      }
    } catch {
      // ignore malformed config
    }
  }

  // Compute counts for diagnostics and potential dry-run preview
  const ids = Array.from(supplierIds)
  const [logsCount, stagingCount, sourcesCount, runRows] = await Promise.all([
    (prisma as any).importLog.count({ where: { templateId: { in: templateIds } } }),
    (prisma as any).partStaging.count({ where: ids.length ? { supplierId: { in: ids } } : undefined }),
    (prisma as any).productSource.count({ where: ids.length ? { supplierId: { in: ids } } : undefined }),
    (prisma as any).importRun.findMany({
      where: ids.length ? { supplierId: { in: ids } } : undefined,
      select: { id: true },
    }),
  ])
  const runIds = (runRows as Array<{ id: string }>).map(r => r.id)
  const [diffsCount, runsCount] = await Promise.all([
    runIds.length ? (prisma as any).importDiff.count({ where: { importRunId: { in: runIds } } }) : Promise.resolve(0),
    runIds.length ? (prisma as any).importRun.count({ where: { id: { in: runIds } } }) : Promise.resolve(0),
  ])

  const counts = {
    templates: templateIds.length,
    logs: logsCount as number,
    staging: stagingCount as number,
    sources: sourcesCount as number,
    runs: runsCount as number,
    diffs: diffsCount as number,
    suppliers: ids,
  }

  if (dryRun) {
    return json({ ok: true, dryRun: true, counts })
  }

  // Concurrency guard: block delete when a prepare or publish is active.
  // Active prepare: preparingRunId set.
  // Active publish: any ImportLog publish:progress within last 5 minutes referencing runId for these templates.
  const activePrepare = await (prisma as any).importTemplate.findMany({
    where: { id: { in: templateIds }, preparingRunId: { not: null } },
    select: { id: true },
  })
  let activePublishTemplateIds: string[] = []
  try {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const publishRows = await (prisma as any).importLog.findMany({
      where: {
        templateId: { in: templateIds },
        type: 'publish:progress',
        at: { gte: recent },
      },
      select: { templateId: true },
    })
    activePublishTemplateIds = Array.from(new Set(publishRows.map((r: { templateId: string }) => r.templateId)))
  } catch {
    activePublishTemplateIds = []
  }
  const blocked = [...activePrepare.map((r: { id: string }) => r.id), ...activePublishTemplateIds]
  if (blocked.length) {
    const code = activePrepare.length ? 'blocked_prepare' : 'blocked_publish'
    const hint =
      code === 'blocked_prepare'
        ? 'Wait for current prepare to finish before deleting this import.'
        : 'Wait for the current publish to complete before deleting this import.'
    return json(
      { error: 'Delete blocked: active prepare or publish in progress', code, templates: blocked, hint },
      { status: 409 },
    )
  }

  // Execute deletions (template-scoped first; related artifacts already scoped by supplier)
  await (prisma as any).importTemplate.deleteMany({ where: { id: { in: templateIds } } })
  if (ids.length) {
    await (prisma as any).partStaging.deleteMany({ where: { supplierId: { in: ids } } })
    await (prisma as any).productSource.deleteMany({ where: { supplierId: { in: ids } } })
    if (runIds.length) {
      await (prisma as any).importDiff.deleteMany({ where: { importRunId: { in: runIds } } })
      await (prisma as any).importRun.deleteMany({ where: { id: { in: runIds } } })
    }
  }

  return json({ ok: true, deleted: templateIds.length, counts })
}

export default function DeleteImporterApi() {
  return null
}
// <!-- END RBP GENERATED: importer-delete-templates-v1 -->
