import type { LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) {
    return new Response('Missing run id', { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = async () => {
        try {
          const run = await prisma.importRun.findUnique({ where: { id: runId } })
          if (!run) {
            controller.enqueue(encoder.encode(`event: end\n`))
            controller.enqueue(encoder.encode(`data: {"error":"not_found","runId":"${runId}"}\n\n`))
            controller.close()
            return
          }
          // Best-effort map run -> templateId via ImportTemplate.preparingRunId
          let templateId: string | null = null
          let templateName: string | null = null
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tpl = await (prisma as any).importTemplate.findFirst({
              where: { preparingRunId: runId },
              select: { id: true, name: true },
            })
            templateId = tpl?.id || null
            templateName = tpl?.name || null
          } catch {
            /* ignore */
          }
          const summary = (run.summary as unknown as { counts?: Record<string, number>; preflight?: unknown }) || {}
          const payload = {
            runId: run.id,
            status: run.status,
            templateId,
            templateName,
            progress: ((run as unknown as { progress?: unknown }).progress as unknown) || null,
            counts: summary.counts || {},
            preflight: summary.preflight || null,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt || null,
          }
          controller.enqueue(encoder.encode(`event: update\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          // Auto-end stream when run is staged, failed, or cancelled
          if (run.status === 'staged' || run.status === 'failed' || run.status === 'cancelled') {
            controller.enqueue(encoder.encode(`event: end\n`))
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ ok: true, runId: run.id, templateId, status: run.status })}\n\n`,
              ),
            )
            controller.close()
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`event: error\n`))
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ message: (err as Error)?.message || 'unknown' })}\n\n`),
          )
        }
      }
      // Send initial snapshot and then poll
      await send()
      const interval = setInterval(send, 1000)
      const abort = request.signal
      const onAbort = () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* noop */
        }
      }
      if (abort.aborted) onAbort()
      abort.addEventListener('abort', onAbort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export default function ImportRunStatusStream() {
  return null
}
