// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'
import { getRowDetails } from '../server/importer/review.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'hq_required' }, { status: 403 })
  const runId = String(params.runId || '')
  const rowId = String(params.rowId || '')
  try {
    const details = await getRowDetails(runId, rowId)
    return json(details)
  } catch (err) {
    return json({ changedFields: [], error: (err as Error)?.message || 'unknown' })
  }
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
