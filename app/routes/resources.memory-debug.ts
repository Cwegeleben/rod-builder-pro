import type { LoaderFunctionArgs } from '@remix-run/node'

// Simple in-process memory diagnostics. Protect by requiring an env token if set.
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const required = process.env.MEMDEBUG_TOKEN
  if (required && token !== required) {
    return new Response('forbidden', { status: 403 })
  }

  // Capture memory + event loop lag sample
  const mem = process.memoryUsage()

  // Optional: lightweight heap stats (Node >= 18). We type this defensively.
  interface HeapStats {
    [k: string]: number
  }
  let heapStats: HeapStats | undefined
  // Access v8 API if present without introducing a build-time dependency.
  const g = global as unknown as { v8?: { getHeapStatistics?: () => HeapStats } }
  if (g.v8?.getHeapStatistics) {
    heapStats = g.v8.getHeapStatistics()
  }

  const payload = {
    timestamp: new Date().toISOString(),
    rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
    heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
    heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
    externalMB: +(mem.external / 1024 / 1024).toFixed(2),
    arrayBuffersMB: +(mem.arrayBuffers / 1024 / 1024).toFixed(2),
    heapStats,
    envOldSpaceLimitMB: process.execArgv
      .filter(a => a.startsWith('--max-old-space-size'))
      .map(a => Number(a.split('=')[1]))[0],
    pid: process.pid,
    uptimeSec: process.uptime(),
  }

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export const config = { runtime: 'nodejs' } as const
