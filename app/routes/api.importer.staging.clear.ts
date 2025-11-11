import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { assertRateLimit } from '../lib/rateLimit.server'

/**
 * Admin-only endpoint to clear staged rows (PartStaging) for a supplier/template scope.
 * POST body (JSON): {
 *   templateId?: string,
 *   supplierId?: string,
 *   dryRun?: boolean,
 *   alsoSeeds?: boolean,          // when true also deletes ProductSource rows in same scope (non-dry run)
 *   runId?: string                // optional runId for future expansion (currently unused, placeholder)
 * }
 * Resolution order:
 *   1. supplierId provided directly.
 *   2. Derive from templateId.importConfig.settings.target -> target.siteId.
 * Scope is narrowed by templateId when provided to avoid cross-template deletion under same supplier.
 * Returns dryRun: { ok: true, dryRun: true, count, scope: { supplierId, templateId? } }
 * Returns delete: { ok: true, deleted, seedsDeleted?, scope: { supplierId, templateId? } }
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)

  // When running in exclusive canonical product_db mode, disable staging clear entirely.
  // This endpoint is legacy and only relevant when using PartStaging as an intermediate surface.
  if (process.env.PRODUCT_DB_EXCLUSIVE === '1' || process.env.PRODUCT_DB_ENABLED === '1') {
    return json({ ok: false, error: 'Staging clear is disabled in canonical product_db mode' }, { status: 404 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = typeof body.templateId === 'string' ? (body.templateId as string).trim() : ''
  let supplierId = typeof body.supplierId === 'string' ? (body.supplierId as string).trim() : ''
  const dryRun = Boolean(body.dryRun)
  const alsoSeeds = Boolean(body.alsoSeeds)
  // Placeholder: runId could later allow deriving templateId if summary captures it
  const runId = typeof body.runId === 'string' ? (body.runId as string).trim() : ''

  const { prisma } = await import('../db.server')

  // Resolve supplierId from template when not provided
  if (!supplierId) {
    if (!templateId) return json({ error: 'templateId or supplierId required' }, { status: 400 })
    const row = await prisma.importTemplate.findUnique({ where: { id: templateId }, select: { importConfig: true } })
    if (!row) return json({ error: 'Template not found' }, { status: 404 })
    const cfg = (row.importConfig as Record<string, unknown> | null) || null
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

  const whereScope: { supplierId: string; templateId?: string | null } = templateId
    ? { supplierId, templateId }
    : { supplierId }

  if (dryRun) {
    const count = await prisma.partStaging.count({ where: whereScope })
    return json({ ok: true, dryRun: true, count, scope: { supplierId, templateId: templateId || undefined } })
  }

  const res = await prisma.partStaging.deleteMany({ where: whereScope })
  let seedsDeleted: number | undefined
  if (alsoSeeds) {
    try {
      const psRes = await prisma.productSource.deleteMany({ where: whereScope })
      seedsDeleted = psRes.count
    } catch {
      /* ignore seeds deletion errors */
    }
  }
  // Best-effort audit log (optional)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).importLog?.create?.({
      data: {
        templateId: templateId || 'n/a',
        runId: runId || 'n/a',
        type: 'staging:clear',
        payload: { supplierId, templateId: templateId || undefined, deleted: res.count, seedsDeleted },
      },
    })
  } catch {
    /* ignore */
  }
  return json({
    ok: true,
    deleted: res.count,
    seedsDeleted,
    scope: { supplierId, templateId: templateId || undefined },
  })
}

export default function ClearStagingApi() {
  return null
}
