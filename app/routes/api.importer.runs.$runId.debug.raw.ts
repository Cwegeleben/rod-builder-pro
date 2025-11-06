// <!-- BEGIN RBP GENERATED: importer-review-debug-raw-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const { prisma } = await import('../db.server')

  try {
    const runRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; status: string; startedAt: string; finishedAt: string | null; summary: unknown }>
    >('SELECT id, status, startedAt, finishedAt, summary FROM ImportRun WHERE id = ? LIMIT 1', runId)
    const run = runRows?.[0]
    if (!run) return json({ error: 'Not found' }, { status: 404 })

    // Keep summary as-is (string or null); attempt JSON.parse only if looks like JSON
    let summaryRaw: string | null = null
    try {
      if (typeof run.summary === 'string') summaryRaw = run.summary
      else if (run.summary && typeof run.summary === 'object') summaryRaw = JSON.stringify(run.summary)
      else summaryRaw = run.summary as string | null
    } catch {
      summaryRaw = typeof run.summary === 'string' ? run.summary : null
    }

    const logs = (
      await prisma.$queryRawUnsafe<Array<{ id: string; type: string; at: string; payload: string | null }>>(
        'SELECT id, type, at, payload FROM ImportLog WHERE runId = ? ORDER BY at DESC LIMIT 10',
        runId,
      )
    ).map(r => ({
      id: r.id,
      type: r.type,
      at: r.at,
      payloadRaw: typeof r.payload === 'string' ? r.payload : r.payload == null ? null : JSON.stringify(r.payload),
      payloadRawLen: (typeof r.payload === 'string' ? r.payload : r.payload == null ? '' : JSON.stringify(r.payload))
        .length,
    }))

    const diffs = (
      await prisma.$queryRawUnsafe<Array<{ id: string; externalId: string; validation: string | null }>>(
        'SELECT id, externalId, validation FROM ImportDiff WHERE importRunId = ? ORDER BY rowid DESC LIMIT 5',
        runId,
      )
    ).map(d => {
      const raw = d.validation
      const s = typeof raw === 'string' ? raw : raw == null ? null : JSON.stringify(raw)
      let mfErrors: Record<string, string> | null = null
      let error: string | null = null
      let detailSample: string | null = null
      let handle: string | null = null
      try {
        if (s && /^\s*\{/.test(s)) {
          const v = JSON.parse(s) as unknown
          const p = v && typeof v === 'object' ? ((v as Record<string, unknown>).publish as unknown) : null
          if (p && typeof p === 'object') {
            const pubObj = p as Record<string, unknown>
            handle = typeof pubObj.handle === 'string' ? (pubObj.handle as string) : null
            mfErrors =
              pubObj.metafieldErrors && typeof pubObj.metafieldErrors === 'object'
                ? (pubObj.metafieldErrors as Record<string, string>)
                : null
            error = typeof pubObj.error === 'string' ? (pubObj.error as string) : null
            const dval = pubObj.detail
            const dstr = typeof dval === 'string' ? dval : dval ? JSON.stringify(dval) : ''
            detailSample = dstr ? String(dstr).slice(0, 512) : null
          }
        }
      } catch {
        // ignore parse errors
      }
      const sample = s ? s.slice(0, 256) : null
      return {
        id: d.id,
        externalId: d.externalId,
        handle,
        publishError: error,
        metafieldErrors: mfErrors,
        detailSample,
        validationRawLen: s ? s.length : 0,
        validationSample: sample,
        validationLooksJson: !!(s && (/^\s*\[/.test(s) || /^\s*\{/.test(s))),
      }
    })

    return json({
      run: { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, summaryRaw },
      logs,
      diffs,
      source: 'raw-minimal',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return json({ error: message }, { status: 200 })
  }
}

export default function ImporterRunDebugRawApi() {
  return null
}
// <!-- END RBP GENERATED: importer-review-debug-raw-v1 -->
