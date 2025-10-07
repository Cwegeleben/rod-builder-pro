import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { requestCancelImportJob } from '../services/importer/jobs'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await requireHqShopOr404(request)
  const id = params.id
  if (!id) return json({ error: 'Missing id' }, { status: 400 })
  const res = await requestCancelImportJob(id)
  if (!res.ok && res.reason === 'NOT_FOUND') return json({ error: 'Not found' }, { status: 404 })
  return json({ ok: true, alreadyFinished: !!res.alreadyFinished })
}

export const loader = () => json({ error: 'Method not allowed' }, { status: 405 })
