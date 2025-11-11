import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const { prisma } = await import('../db.server')
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(10, Number(url.searchParams.get('pageSize') || '2')))

  if (!runId) return new Response('Missing runId', { status: 400 })

  let total = 0
  let rows: Array<{ id: string; diffType: string; externalId: string | null }> = []
  try {
    total = await prisma.importDiff.count({ where: { importRunId: runId } })
    const found = await prisma.importDiff.findMany({
      where: { importRunId: runId },
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, diffType: true, externalId: true },
    })
    rows = found.map(r => ({ id: r.id, diffType: r.diffType, externalId: r.externalId }))
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'query failed' }, { status: 500 })
  }

  return json({ ok: true, total, page, pageSize, rows })
}

export const handle = { private: true }
