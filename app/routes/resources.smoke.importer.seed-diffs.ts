import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.server'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')
  const count = Number(url.searchParams.get('count') || '3')
  if (!runId) return new Response('Missing runId', { status: 400 })

  const before: Prisma.JsonObject = { title: 'Before', price: 10 }
  const after: Prisma.JsonObject = { title: 'After', price: 12 }

  const created = await prisma.$transaction(async tx => {
    const rows = [] as { id: string }[]
    for (let i = 0; i < count; i++) {
      const row = await tx.importDiff.create({
        data: {
          importRunId: runId,
          externalId: `ext-${Date.now()}-${i}`,
          diffType: 'change',
          before,
          after,
        },
        select: { id: true },
      })
      rows.push(row)
    }
    return rows
  })

  return json({ ok: true, ids: created.map(r => r.id) })
}

export const handle = { private: true }
