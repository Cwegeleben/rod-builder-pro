import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'

// POST/GET: /resources/smoke/importer/cancel/:runId
// Marks summary.control.cancelRequested=true so long-running crawls can stop gracefully.
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Auth guard (smoke token, skips HQ)
  guardSmokeRoute({ request } as LoaderFunctionArgs)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })

  try {
    // Ensure ImportRun exists in environments where schema might be lazy
    try {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS ImportRun (id TEXT PRIMARY KEY NOT NULL, supplierId TEXT NOT NULL, startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt DATETIME, status TEXT NOT NULL, progress TEXT, summary TEXT)',
      )
    } catch {
      /* ignore */
    }

    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return json({ ok: false, error: 'Not found' }, { status: 404 })
    const prev = (() => {
      try {
        if (typeof run.summary === 'string') return JSON.parse(run.summary)
        return (run.summary as unknown) || {}
      } catch {
        return {}
      }
    })() as Record<string, unknown>
    const control = { ...(prev.control as Record<string, unknown> | undefined), cancelRequested: true }
    const next = { ...prev, control }
    await prisma.importRun.update({ where: { id: runId }, data: { summary: next as unknown as object } })
    return json({ ok: true, runId, control })
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'failed' }, { status: 500 })
  }
}

export const action = loader

export default function SmokeImporterCancelRun() {
  return null
}
