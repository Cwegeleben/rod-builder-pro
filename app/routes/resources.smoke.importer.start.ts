import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { prisma } from '../db.server'
import type { Prisma } from '@prisma/client'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async (args: LoaderFunctionArgs) => {
  guardSmokeRoute(args)

  // Create a minimal ImportRun to support Fly smokes without Shopify embedding.
  const run = await prisma.importRun.create({
    data: {
      supplierId: 'smoke',
      status: 'started',
      summary: { source: 'smoke' } as Prisma.JsonObject,
    },
  })

  return json({ ok: true, runId: run.id })
}

export const handle = { private: true }
