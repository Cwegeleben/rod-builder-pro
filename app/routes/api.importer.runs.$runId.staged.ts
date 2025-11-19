// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'
import { computeColumnsRegistry, computeTotals, queryStagedRows } from '../server/importer/review.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'hq_required' }, { status: 403 })
  const runId = String(params.runId || '')
  const url = new URL(request.url)
  const tab = (url.searchParams.get('tab') as 'unlinked' | 'linked' | 'conflicts' | 'all') || 'all'
  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1)
  const pageSize = [25, 50].includes(Number(url.searchParams.get('pageSize')))
    ? Number(url.searchParams.get('pageSize'))
    : 25

  // Filters
  const status = url.searchParams.getAll('status') as Array<'staged' | 'approved' | 'rejected'>
  const vendor = url.searchParams.getAll('vendor')
  const availability = url.searchParams.getAll('availability')
  const confidenceMin = url.searchParams.get('confidenceMin')
  const confidenceMax = url.searchParams.get('confidenceMax')
  const q = url.searchParams.get('q') || undefined
  const attrKey = url.searchParams.get('attr.key') || undefined
  const attrOp = (url.searchParams.get('attr.op') as 'eq' | 'neq' | 'gt' | 'lt' | 'contains') || undefined
  const attrVal = url.searchParams.get('attr.val') || undefined

  const filters = {
    status: status.length ? status : undefined,
    vendor: vendor.length ? vendor : undefined,
    availability: availability.length ? availability : undefined,
    confidenceMin: confidenceMin ? Number(confidenceMin) : undefined,
    confidenceMax: confidenceMax ? Number(confidenceMax) : undefined,
    q,
    attribute: attrKey && attrOp && attrVal ? { key: attrKey, operator: attrOp, value: attrVal } : undefined,
  }

  try {
    const [columns, totals, list] = await Promise.all([
      computeColumnsRegistry(runId),
      computeTotals(runId),
      queryStagedRows({ runId, tab, page, pageSize, filters }),
    ])
    return json({ ...list, columns, totals })
  } catch (err) {
    // Defensive: avoid bubbling 500s into the client; return an empty payload with error message
    const message = (err as Error)?.message || 'unknown'
    return json({
      rows: [],
      columns: [],
      totals: { unlinked: 0, linked: 0, conflicts: 0, all: 0 },
      page: 1,
      pageSize,
      totalPages: 1,
      error: message,
    })
  }
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
