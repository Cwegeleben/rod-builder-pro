import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { assertRateLimit } from '../lib/rateLimit.server'

/**
 * Admin-only endpoint to clear staged rows for a supplier.
 * POST body (JSON): { templateId?: string, supplierId?: string, dryRun?: boolean }
 * If templateId is provided, supplierId will be derived from ImportTemplate.importConfig.settings.target.
 * Returns: { ok: true, deleted?: number, count?: number }
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = typeof body.templateId === 'string' ? (body.templateId as string) : ''
  let supplierId = typeof body.supplierId === 'string' ? (body.supplierId as string) : ''
  const dryRun = Boolean(body.dryRun)

  const { prisma } = await import('../db.server')

  // Resolve supplierId from template when not provided
  if (!supplierId) {
    if (!templateId) return json({ error: 'templateId or supplierId required' }, { status: 400 })
    const row = await prisma.importTemplate.findUnique({ where: { id: templateId }, select: { importConfig: true } })
    const cfg = (row?.importConfig as Record<string, unknown> | null) || null
    const settings = (cfg?.['settings'] as Record<string, unknown> | null) || null
    const targetId = typeof settings?.['target'] === 'string' ? (settings?.['target'] as string) : ''
    if (!targetId) return json({ error: 'No target in template settings' }, { status: 400 })
    try {
      const { getTargetById } = await import('../server/importer/sites/targets')
      const t = getTargetById(targetId)
      supplierId = (t?.siteId as string) || targetId
    } catch {
      supplierId = targetId
    }
  }

  // Basic rate limit: up to 3 clears per minute per supplier
  assertRateLimit({ key: `staging:clear:${supplierId}`, limit: 3, windowMs: 60_000 })

  if (dryRun) {
    const count = await prisma.partStaging.count({ where: { supplierId } })
    return json({ ok: true, dryRun: true, count })
  }

  const res = await prisma.partStaging.deleteMany({ where: { supplierId } })
  // Best-effort audit log (optional)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).importLog?.create?.({
      data: {
        templateId: templateId || 'n/a',
        runId: 'n/a',
        type: 'staging:clear',
        payload: { supplierId, deleted: res.count },
      },
    })
  } catch {
    /* ignore */
  }
  return json({ ok: true, deleted: res.count })
}

export default function ClearStagingApi() {
  return null
}
