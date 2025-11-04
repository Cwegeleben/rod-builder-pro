// <!-- BEGIN RBP GENERATED: importer-delete-templates-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

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

  const body = (await read()) as { templateIds?: unknown }
  const templateIds = Array.isArray(body.templateIds)
    ? (body.templateIds as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  if (templateIds.length === 0) return json({ error: 'Missing templateIds' }, { status: 400 })

  const { prisma } = await import('../db.server')
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

  // Delete templates (ImportLog cascades)
  await (prisma as any).importTemplate.deleteMany({ where: { id: { in: templateIds } } })

  // Best-effort cleanup for supplier-related artifacts
  if (supplierIds.size > 0) {
    const ids = Array.from(supplierIds)
    // PartStaging and ProductSource by supplierId
    await (prisma as any).partStaging.deleteMany({ where: { supplierId: { in: ids } } })
    await (prisma as any).productSource.deleteMany({ where: { supplierId: { in: ids } } })
    // ImportRun and ImportDiff by supplierId
    const runs = (await (prisma as any).importRun.findMany({
      where: { supplierId: { in: ids } },
      select: { id: true },
    })) as Array<{ id: string }>
    if (runs.length > 0) {
      const runIds = runs.map(r => r.id)
      await (prisma as any).importDiff.deleteMany({ where: { importRunId: { in: runIds } } })
      await (prisma as any).importRun.deleteMany({ where: { id: { in: runIds } } })
    }
  }

  return json({ ok: true, deleted: templateIds.length, suppliers: Array.from(supplierIds) })
}

export default function DeleteImporterApi() {
  return null
}
// <!-- END RBP GENERATED: importer-delete-templates-v1 -->
