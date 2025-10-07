// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getJobStatus } from '../services/importer/jobs'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireHqShopOr404(request)
  const id = params.id!
  const status = await getJobStatus(id)
  if (!status) return json({ error: 'Not found' }, { status: 404 })
  return json(status)
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
