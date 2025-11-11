import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const { prisma } = await import('../db.server')
  const url = new URL(request.url)
  const runId = url.searchParams.get('runId')
  if (!runId) return new Response('Missing runId', { status: 400 })

  const total = await prisma.importDiff.count({ where: { importRunId: runId } })
  const byType = await prisma.importDiff.groupBy({
    by: ['diffType'],
    where: { importRunId: runId },
    _count: { _all: true },
  })

  // Missing images: count diffs where after.images is absent or empty
  const rows = await prisma.importDiff.findMany({ where: { importRunId: runId }, select: { after: true } })
  let missingImagesTotal = 0
  for (const r of rows) {
    const after = r.after as unknown as Record<string, unknown> | null
    const imagesField = after && (after as Record<string, unknown>)['images']
    const arr = Array.isArray(imagesField) ? (imagesField as unknown[]) : []
    if (arr.length === 0) missingImagesTotal++
  }

  return json({
    ok: true,
    total,
    counts: Object.fromEntries(byType.map(x => [x.diffType, x._count._all])),
    missingImagesTotal,
  })
}

export const handle = { private: true }
