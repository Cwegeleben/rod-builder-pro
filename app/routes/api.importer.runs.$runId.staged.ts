// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { computeColumnsRegistry, computeTotals, queryStagedRows } from '../server/importer/review.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
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

  const [columns, totals, list] = await Promise.all([
    computeColumnsRegistry(runId),
    computeTotals(runId),
    queryStagedRows({ runId, tab, page, pageSize, filters }),
  ])

  return json({ ...list, columns, totals })
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
