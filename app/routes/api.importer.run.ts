// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { enqueueImportJob } from '../services/importer/jobs'
import { assertRateLimit } from '../lib/rateLimit.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireHqShopOr404(request)
  // Rate limit: 3 runs per 60s
  assertRateLimit({ key: 'importer:run:rbp-hq-dev', limit: 3, windowMs: 60_000 })
  const body = await request.json()
  const { url, productType, mapping } = body
  if (!url || !productType || !mapping) return json({ error: 'Missing params' }, { status: 400 })
  const { jobId, status } = await enqueueImportJob({ url, productType, mapping })
  return json({ jobId, status })
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
