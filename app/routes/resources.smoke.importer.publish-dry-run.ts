import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'
import { publishRunToShopify } from '../services/importer/publishShopify.server'

export async function loader({ request }: LoaderFunctionArgs) {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = String(url.searchParams.get('runId') || '')
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })

  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })

  // Preconditions similar to publish route: at least one approved
  const approved = await prisma.importDiff.count({ where: { importRunId: runId, resolution: 'approve' } })
  if (approved === 0) return json({ ok: false, error: 'No approved items to publish' }, { status: 400 })

  const { totals, productIds } = await publishRunToShopify({ runId, dryRun: true })
  return json({ ok: true, runId, totals, productIds })
}

export const handle = { private: true }

export default function SmokePublishDryRun() {
  return null
}
