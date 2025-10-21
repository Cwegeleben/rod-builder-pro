import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { prisma } from '../db.server'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })

  const row = await prisma.importDiff.findUnique({
    where: { id },
    select: { id: true, importRunId: true, diffType: true, externalId: true, before: true, after: true },
  })
  if (!row) return new Response('Not Found', { status: 404 })

  return json({ ok: true, diff: row })
}

export const handle = { private: true }
