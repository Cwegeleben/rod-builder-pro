import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { prisma } from '../db.server'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')
  if (!runId) return new Response('Missing runId', { status: 400 })

  const run = await prisma.importRun.findUnique({ where: { id: runId }, select: { status: true } })
  if (!run) return new Response('Not Found', { status: 404 })

  const alreadyApplied = run.status === 'success'
  if (!alreadyApplied) {
    await prisma.importRun.update({ where: { id: runId }, data: { status: 'success' } })
  }
  return json({ ok: true, runId, action: 'applied', changed: alreadyApplied ? 0 : 1 })
}

export const handle = { private: true }
