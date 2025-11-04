import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { queryStagedRows, computeTotals } from '../server/importer/review.server'

export async function loader(args: LoaderFunctionArgs) {
  guardSmokeRoute(args)
  const url = new URL(args.request.url)
  const runId = String(url.searchParams.get('runId') || '')
  const tab = (url.searchParams.get('tab') as 'unlinked' | 'linked' | 'conflicts' | 'all') || 'all'
  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1)
  const pageSize = [25, 50].includes(Number(url.searchParams.get('pageSize')))
    ? Number(url.searchParams.get('pageSize'))
    : 25
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })
  const list = await queryStagedRows({
    runId,
    tab,
    page,
    pageSize,
    filters: {},
  })
  const totals = await computeTotals(runId)
  return json({
    ok: true,
    runId,
    totals,
    page: list.page,
    pageSize: list.pageSize,
    totalPages: list.totalPages,
    rows: list.rows,
  })
}

// No default export to keep this a pure JSON resource route
