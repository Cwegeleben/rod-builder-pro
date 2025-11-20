import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { DELETE_ERROR_CODES } from '../services/importer/delete.constants'
import { buildDeletePlan, type DeletePlan } from '../services/importer/deletePlan.server'

// POST /api/importer/delete[?dry=1]
// Deletes one or more import templates and all related importer data: logs, runs, diffs, staging parts, product sources.
// Dry-run (preview) mode returns counts only without deleting. Requires HQ.
// Body (JSON): { templateIds: string[] }
// Response (dry): { ok: true, counts: { templates, logs, runs, diffs, staging, sources } }
// Response (commit): { ok: true, deleted: { templates, logs, runs, diffs, staging, sources } }
// Error: { error, code?, hint? }

export async function action({ request }: ActionFunctionArgs) {
  // Soft HQ guard: returns 403 JSON instead of HTML shell
  try {
    await requireHqShopOr404(request)
  } catch {
    return json({ error: 'hq_required' }, { status: 403 })
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let templateIds: string[] = []
  let bodyDryRun = false
  try {
    const ct = request.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>
      if (Array.isArray(body?.templateIds)) {
        templateIds = (body!.templateIds as unknown[]).filter((x): x is string => typeof x === 'string')
      }
      if (body && (body['dryRun'] === true || body['dryRun'] === '1')) bodyDryRun = true
    } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await request.formData()
      const raw = fd.getAll('templateIds')
      templateIds = raw.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    /* ignore parse errors */
  }
  const url = new URL(request.url)
  if (!templateIds.length) {
    // Fallback to single templateId param
    const single = url.searchParams.get('templateId') || ''
    if (single) templateIds = [single]
  }
  if (!templateIds.length) return json({ error: 'Missing templateIds', code: 'missing_template_ids' }, { status: 400 })

  // Allow dry-run via query (?dry=1) or JSON body { dryRun: true | "1" }
  const dry = url.searchParams.get('dry') === '1' || bodyDryRun
  const force = url.searchParams.get('force') === '1'

  try {
    const { prisma } = await import('../db.server')

    const started = performance.now()
    const plan: DeletePlan = await buildDeletePlan({ prisma: prisma as any, templateIds, dry, force })

    if (!plan.templates.length) {
      return json({ error: 'No templates found', code: DELETE_ERROR_CODES.NOT_FOUND }, { status: 404 })
    }

    if (plan.blockers.length && !force) {
      const blockerIds = Array.from(
        new Set(plan.blockers.flatMap((b: { code: string; templateIds: string[] }) => b.templateIds)),
      )
      const hasPrepare = plan.blockers.some((b: { code: string }) => b.code === 'active_prepare')
      const hasPublish = plan.blockers.some((b: { code: string }) => b.code === 'publish_in_progress')
      let msg = 'Blocked: delete restrictions active'
      if (hasPublish && !hasPrepare && plan.blockers.length === 1)
        msg = 'Blocked: publish in progress for one or more templates'
      else if (hasPrepare && !hasPublish && plan.blockers.length === 1)
        msg = 'Blocked: active prepare run detected for one or more templates'
      return json(
        {
          error: msg,
          code: DELETE_ERROR_CODES.BLOCKED,
          blockers: plan.blockers.map((b: { code: string; templateIds: string[] }) => ({
            code: b.code,
            templateIds: b.templateIds,
          })),
          templates: blockerIds,
          hint: 'Use ?force=1 to override blockers if appropriate.',
        },
        { status: 409 },
      )
    }

    if (dry) {
      // Attempt audit logging (best-effort)
      try {
        const auditClient = (
          prisma as unknown as {
            importDeleteAudit?: { create: (args: unknown) => Promise<unknown> }
          }
        ).importDeleteAudit
        if (auditClient) {
          await auditClient.create({
            data: {
              templateIds: plan.templates.map(t => t.id).join(','),
              countsJson: plan.counts,
              dryRun: true,
              forced: force,
              userHq: true,
              blockedCodes: plan.blockers.map((b: { code: string }) => b.code).join(',') || null,
              durationMs: Math.round(performance.now() - started),
            },
          })
        }
      } catch {
        /* ignore audit errors */
      }
      return json(
        {
          ok: true,
          dryRun: true,
          forced: force || undefined,
          counts: plan.counts,
          blockersForced: force ? plan.blockers.map((b: { code: string }) => b.code) : undefined,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Perform deletion in a transaction for consistency
    // Order: diffs -> logs -> staging -> sources -> runs -> templates (runs not FK-linked by templateId but we clean them for completeness)
    // Note: ImportRun has no direct templateId; deleting runs only when referenced by logs prevents orphaned data noise.
    const performDeletes = async (tx: typeof prisma) => {
      try {
        if (plan.counts.diffs && plan.runIds.length)
          await tx.importDiff.deleteMany({ where: { importRunId: { in: plan.runIds } } })
      } catch {
        /* ignore pattern errors */
      }
      try {
        if (plan.counts.logs) await tx.importLog.deleteMany({ where: { templateId: { in: templateIds } } })
      } catch {
        /* ignore */
      }
      try {
        if (plan.counts.staging) await tx.partStaging.deleteMany({ where: { templateId: { in: templateIds } } })
      } catch {
        /* ignore */
      }
      try {
        if (plan.counts.sources) await tx.productSource.deleteMany({ where: { templateId: { in: templateIds } } })
      } catch {
        /* ignore */
      }
      try {
        if (plan.counts.runs && plan.runIds.length)
          await tx.importRun.deleteMany({ where: { id: { in: plan.runIds } } })
      } catch {
        /* ignore */
      }
      const tplDeleted = await tx.importTemplate.deleteMany({ where: { id: { in: templateIds } } })
      return { tplDeleted: tplDeleted.count }
    }
    // Transaction fallback if prisma.$transaction absent in test mocks
    const result =
      typeof (prisma as unknown as { $transaction?: unknown }).$transaction === 'function'
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).$transaction((inner: typeof prisma) => performDeletes(inner))
        : await performDeletes(prisma)

    const deletedDetails = {
      templates: result.tplDeleted,
      logs: plan.counts.logs,
      runs: plan.counts.runs,
      diffs: plan.counts.diffs,
      staging: plan.counts.staging,
      sources: plan.counts.sources,
    }

    // Audit (best-effort)
    try {
      const auditClient = (prisma as unknown as { importDeleteAudit?: { create: (args: unknown) => Promise<unknown> } })
        .importDeleteAudit
      if (auditClient) {
        await auditClient.create({
          data: {
            templateIds: plan.templates.map((t: { id: string }) => t.id).join(','),
            countsJson: plan.counts,
            deletedJson: deletedDetails,
            dryRun: false,
            forced: force,
            userHq: true,
            blockedCodes: plan.blockers.map((b: { code: string }) => b.code).join(',') || null,
            durationMs: Math.round(performance.now() - started),
          },
        })
      }
    } catch {
      /* ignore */
    }

    return json(
      {
        ok: true,
        forced: force || undefined,
        deleted: result.tplDeleted,
        deletedDetails,
        durationMs: Math.round(performance.now() - started),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    const message = (err as Error)?.message || 'Delete failed'
    const lower = message.toLowerCase()
    const patternHint = lower.includes('did not match the expected pattern')
      ? 'One or more related run IDs had invalid format; core template row may still be intact. Try again or use force if implemented.'
      : undefined
    return json({ error: message, hint: patternHint, code: DELETE_ERROR_CODES.UNKNOWN }, { status: 500 })
  }
}

export default function ImporterDeleteRoute() {
  return null
}
