// <!-- BEGIN RBP GENERATED: importer-run-log-tail-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

// Provides a lightweight tail of recent ImportLog entries for a specific run.
// Query params:
//   take: number (1-100, default 25)
//   before: ISO timestamp to fetch logs older than this time
//   afterId: log id to fetch logs newer than this id (exclusive)
// Response: { logs: [{ id, at, type, payload }], more: boolean }
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const { prisma } = await import('../db.server')
  const url = new URL(request.url)
  const takeRaw = url.searchParams.get('take')
  const beforeRaw = url.searchParams.get('before') || ''
  const afterId = url.searchParams.get('afterId') || ''
  const take = Math.min(100, Math.max(1, Number(takeRaw || 25)))

  let before: Date | undefined
  if (beforeRaw) {
    const d = new Date(beforeRaw)
    if (!isNaN(d.getTime())) before = d
  }

  // Build where clause
  const where: Record<string, unknown> = { runId }
  if (before) where.at = { lt: before }
  // If afterId provided, fetch that row to derive its timestamp and then constrain greaterThan
  if (afterId) {
    try {
      const row = await (
        prisma as unknown as {
          importLog: { findUnique: (q: { where: { id: string } }) => Promise<{ at?: string } | null> }
        }
      ).importLog.findUnique({ where: { id: afterId } })
      if (row?.at) {
        where.at = { ...(where.at || {}), gt: row.at }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const logs = (await (
      prisma as unknown as {
        importLog: {
          findMany: (q: {
            where: Record<string, unknown>
            orderBy: { at: 'desc' }
            take: number
          }) => Promise<Array<{ id: string; at: string; type: string; payload?: unknown }>>
        }
      }
    ).importLog.findMany({
      where,
      orderBy: { at: 'desc' },
      take: take + 1, // fetch one extra to signal more
    })) as Array<{ id: string; at: string; type: string; payload?: unknown }>
    const more = logs.length > take
    const trimmed = logs.slice(0, take).map(l => ({
      id: l.id,
      at: l.at,
      type: l.type,
      // Keep payload small: stringify if simple object, else omit large body
      payload: (() => {
        const v = l.payload
        if (v == null) return null
        if (typeof v === 'string') return v.length <= 500 ? v : v.slice(0, 500)
        if (typeof v === 'object') {
          try {
            const s = JSON.stringify(v)
            return s.length <= 500 ? s : s.slice(0, 500)
          } catch {
            return '<<unserializable>>'
          }
        }
        return String(v).slice(0, 500)
      })(),
    }))
    return json({ logs: trimmed, more })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return json({ logs: [], more: false, error: message }, { status: 200 })
  }
}

export default function ImporterRunLogTailApi() {
  return null
}
// <!-- END RBP GENERATED: importer-run-log-tail-v1 -->
