import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
// smoke guards and prisma are imported with correct relative paths
import { prisma } from '../db.server'

export async function action(args: ActionFunctionArgs) {
  // Minimal guard using internal helpers directly to avoid any-casts
  const { requireSmokesEnabled, requireSmokeAuth } = await import('../lib/smokes.server')
  requireSmokesEnabled()
  requireSmokeAuth(args.request)
  const url = new URL(args.request.url)
  const runId = String(url.searchParams.get('runId') || '')
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })
  const limit = Number(url.searchParams.get('limit') || '0')
  // Approve all ADD diffs for the run (optionally limit)
  const ids = (
    await prisma.importDiff.findMany({
      where: { importRunId: runId, diffType: 'add', resolution: null },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit && Number.isFinite(limit) && limit > 0 ? limit : undefined,
    })
  ).map(r => r.id)
  if (!ids.length) return json({ ok: true, approved: 0 })
  const r = await prisma.importDiff.updateMany({
    where: { importRunId: runId, id: { in: ids } },
    data: { resolution: 'approve', resolvedAt: new Date() },
  })
  return json({ ok: true, approved: r.count })
}
// No default export: keep this as a JSON-only resource route
