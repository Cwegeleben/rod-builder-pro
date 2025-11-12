import type { LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404, isHqShop } from '../lib/access.server'
import { prisma } from '../db.server'

// Unified Server-Sent Events stream: emits progress + logs for a run
// GET: /api/importer/runs/:runId/stream
// Events:
// - event: progress { runId, status, progress, seedIndex?, seedsTotal?, etaSeconds?, stuck?, lastUpdated?, startedAt? }
// - event: log { logs: [{id, at, type, payload}], nextCursor }
// - event: ping { ts }
// - event: end { runId, status }
// - event: error { message }
// Simple in-memory connection caps per shop (best-effort; resets on deploy)
const STREAM_CONNS: Record<string, number> = {}
const MAX_PER_SHOP = Number(process.env.IMPORTER_STREAM_MAX_CONN || 5)

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return new Response('Missing run id', { status: 400 })

  const url = new URL(request.url)
  const initialCursor = url.searchParams.get('cursor') || ''
  const logBatchSize = Math.min(50, Math.max(5, Number(url.searchParams.get('take') || 15)))
  // Derive a coarse shop key for connection capping
  let shopKey = 'unknown'
  try {
    if (url.searchParams.get('hq') === '1') shopKey = 'hq'
  } catch {
    /* ignore */
  }
  try {
    if (await isHqShop(request)) shopKey = 'hq'
  } catch {
    /* ignore */
  }
  if (!STREAM_CONNS[shopKey]) STREAM_CONNS[shopKey] = 0
  if (STREAM_CONNS[shopKey] >= MAX_PER_SHOP) return new Response('Too many active streams', { status: 429 })
  STREAM_CONNS[shopKey]++

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let lastProgressJson = ''
      let cursor = initialCursor

      async function sendProgressSnapshot() {
        try {
          const run = await prisma.importRun.findUnique({ where: { id: runId } })
          if (!run) {
            send('end', { runId, status: 'not_found' })
            controller.close()
            return false
          }
          const progress = ((run as unknown as { progress?: unknown }).progress || {}) as Record<string, unknown>
          const details = (progress['details'] as Record<string, unknown> | undefined) || undefined
          const seedIndex = typeof details?.['seedIndex'] === 'number' ? (details['seedIndex'] as number) : undefined
          const seedsTotal = typeof details?.['seedsTotal'] === 'number' ? (details['seedsTotal'] as number) : undefined
          const etaSeconds = typeof progress['etaSeconds'] === 'number' ? (progress['etaSeconds'] as number) : undefined
          const lastUpdated =
            typeof progress['lastUpdated'] === 'string' ? (progress['lastUpdated'] as string) : undefined
          const finished = Boolean(run.finishedAt)
          let stuck = false
          if (
            !finished &&
            run.status &&
            run.status !== 'staged' &&
            run.status !== 'failed' &&
            run.status !== 'cancelled'
          ) {
            if (run.status === 'stuck') stuck = true
            else if (lastUpdated) {
              try {
                if (Date.now() - new Date(lastUpdated).getTime() > 120_000) stuck = true
              } catch {
                /* ignore */
              }
            }
          }
          const payload = {
            runId,
            status: run.status,
            progress,
            seedIndex,
            seedsTotal,
            etaSeconds,
            stuck,
            lastUpdated,
            startedAt: run.startedAt,
          }
          const key = JSON.stringify(payload)
          if (key !== lastProgressJson) {
            lastProgressJson = key
            send('progress', payload)
          }
          if (run.status === 'staged' || run.status === 'failed' || run.status === 'cancelled') {
            send('end', { runId, status: run.status })
            controller.close()
            return false
          }
          return true
        } catch (e) {
          send('error', { message: (e as Error)?.message || 'progress_failed' })
          return true
        }
      }

      async function sendLogBatch() {
        try {
          // Build where clause using cursor (afterId semantics)
          const where: Record<string, unknown> = { runId }
          if (cursor) {
            try {
              const row = await prisma.importLog.findUnique({ where: { id: cursor } })
              if (row?.at) where.at = { gt: row.at }
            } catch {
              /* ignore */
            }
          }
          const logs = await prisma.importLog.findMany({
            where,
            orderBy: { at: 'desc' },
            take: logBatchSize,
          })
          if (logs.length) {
            // Stream in reverse chronological as received; client can handle display
            const trimmed = logs.map(l => ({
              id: l.id,
              at: l.at,
              type: l.type,
              payload: (() => {
                const v = l.payload as unknown
                if (v == null) return null
                if (typeof v === 'string') return v.length <= 500 ? v : v.slice(0, 500)
                if (typeof v === 'object') {
                  try {
                    const s = JSON.stringify(v)
                    return s.length <= 500 ? s : s.slice(0, 500)
                  } catch {
                    return '<<unserializable>>'
                  }
                }
                return String(v).slice(0, 500)
              })(),
            }))
            cursor = logs[0]!.id
            send('log', { logs: trimmed, nextCursor: cursor })
          }
        } catch (e) {
          send('error', { message: (e as Error)?.message || 'logs_failed' })
        }
      }

      // Kick off with immediate progress + initial logs
      const ok = await sendProgressSnapshot()
      if (ok === false) return
      await sendLogBatch()
      send('ping', { ts: Date.now() })

      const interval = setInterval(async () => {
        const cont = await sendProgressSnapshot()
        if (cont === false) {
          clearInterval(interval)
          return
        }
        await sendLogBatch()
        send('ping', { ts: Date.now() })
      }, 1000)

      const onAbort = () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* ignore */
        }
        // Decrement connection count
        if (STREAM_CONNS[shopKey] && STREAM_CONNS[shopKey] > 0) STREAM_CONNS[shopKey]--
      }
      request.signal.addEventListener('abort', onAbort)
      if (request.signal.aborted) onAbort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-RBP-Stream': `run:${runId}`,
    },
  })
}

export default function ImporterRunUnifiedStream() {
  return null
}
