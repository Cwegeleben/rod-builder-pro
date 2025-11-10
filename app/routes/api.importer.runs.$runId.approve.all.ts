import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import type { Prisma } from '@prisma/client'

// POST /api/importer/runs/:runId/approve/all[?types=add,change][&all=1]
// Approves all diffs for the given types (default: add). Supports force via all=1 to re-approve previously rejected.
export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })

  try {
    const url = new URL(request.url)
    const qTypes = String(url.searchParams.get('types') || '').trim()
    const qAll = url.searchParams.get('all') === '1'
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const bTypes = Array.isArray((body as { types?: string[] }).types)
      ? ((body as { types?: string[] }).types as string[]).join(',')
      : typeof (body as { types?: string }).types === 'string'
        ? (body as { types?: string }).types
        : ''
    const bAll = Boolean((body as { all?: boolean }).all)

    const typesRaw = (qTypes || bTypes || 'add')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const allowed = new Set(['add', 'change'])
    const types = Array.from(new Set(typesRaw.filter(t => allowed.has(t)))) as Array<'add' | 'change'>
    if (!types.length) types.push('add')
    const allFlag = qAll || bAll

    // Build where clauses
    const base: Prisma.ImportDiffWhereInput = { importRunId: runId, diffType: { in: types as unknown as string[] } }
    const whereForUpdate: Prisma.ImportDiffWhereInput = allFlag
      ? { ...base, resolution: { not: 'approve' } }
      : { ...base, OR: [{ resolution: null }, { resolution: 'pending' }] }

    // Totals per type
    const totals: Record<string, number> = {}
    for (const t of types) {
      totals[t] = await prisma.importDiff.count({ where: { importRunId: runId, diffType: t } })
    }
    const unresolved = await prisma.importDiff.count({
      where: {
        importRunId: runId,
        diffType: { in: types as unknown as string[] },
        OR: [{ resolution: null }, { resolution: 'pending' }],
      },
    })

    const res = await prisma.importDiff.updateMany({
      where: whereForUpdate,
      data: { resolution: 'approve', resolvedAt: new Date() },
    })

    // Log action
    try {
      const run = await prisma.importRun.findUnique({ where: { id: runId } })
      const summary = (run?.summary as unknown as { options?: { templateId?: string; notes?: string } }) || {}
      const tpl = summary.options?.templateId || (summary.options?.notes || '').replace(/^prepare:/, '') || 'n/a'
      await prisma.importLog.create({
        data: {
          templateId: tpl,
          runId,
          type: 'review:approve-bulk',
          payload: { types, totals, unresolved, updated: res.count, all: allFlag },
        },
      })
    } catch {
      /* ignore logging errors */
    }

    return json({ ok: true, types, totals, unresolved, updated: res.count, all: allFlag })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export default function ApproveAllApi() {
  return null
}
