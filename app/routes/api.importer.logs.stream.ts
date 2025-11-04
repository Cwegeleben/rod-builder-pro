// <!-- BEGIN RBP GENERATED: importer-logs-sse-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const { prisma } = await import('../db.server')

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      let lastAt: string | null = null

      const send = async () => {
        try {
          const logs = (await (prisma as any).importLog.findMany({ orderBy: { at: 'desc' }, take: 25 })) as Array<{
            at: string
            templateId: string
            runId: string
            type: string
            payload?: unknown
          }>
          const newest = logs[0]?.at || null
          if (newest !== lastAt) {
            lastAt = newest
            const chunk = `data: ${JSON.stringify({ logs })}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }
        } catch {
          const chunk = `event: error\ndata: ${JSON.stringify({ message: 'stream error' })}\n\n`
          try {
            controller.enqueue(encoder.encode(chunk))
          } catch {
            // ignore
          }
        }
      }

      // initial push
      await send()
      const interval = setInterval(send, 2000)

      const close = () => {
        if (closed) return
        closed = true
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // ignore
        }
      }

      // Handle client disconnect
      const signal = (request as any).signal as AbortSignal | undefined
      if (signal) {
        if (signal.aborted) close()
        else signal.addEventListener('abort', close)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export default function ImporterLogsStream() {
  return null
}
// <!-- END RBP GENERATED: importer-logs-sse-v1 -->
