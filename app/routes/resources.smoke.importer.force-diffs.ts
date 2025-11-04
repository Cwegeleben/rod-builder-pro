import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { Prisma } from '@prisma/client'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'

export async function loader({ request }: LoaderFunctionArgs) {
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const url = new URL(request.url)
  const runId = String(url.searchParams.get('runId') || '')
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })

  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })
  const supplierId = run.supplierId

  // Read all staged rows for supplier and synthesize ADD diffs for this run
  const staged = await prisma.partStaging.findMany({ where: { supplierId } })
  // Clear existing diffs for the run to ensure deterministic output
  await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
  if (!staged.length) return json({ ok: true, created: 0 })

  const created = await prisma.$transaction(async tx => {
    let n = 0
    for (const s of staged) {
      const after: Prisma.JsonObject = {
        title: s.title,
        partType: s.partType,
        description: s.description ?? null,
        images: (s.images as unknown as Prisma.JsonValue) ?? null,
        rawSpecs: (s.rawSpecs as unknown as Prisma.JsonValue) ?? null,
        normSpecs: (s.normSpecs as unknown as Prisma.JsonValue) ?? null,
        // Avoid undefined in JSON payloads; use null or omit
        sourceUrl: null,
      }
      await tx.importDiff.create({
        data: {
          importRunId: runId,
          externalId: s.externalId,
          diffType: 'add',
          after,
        },
      })
      n++
    }
    return n
  })
  return json({ ok: true, created })
}

export const handle = { private: true }

// No default export to keep this a pure JSON resource route
