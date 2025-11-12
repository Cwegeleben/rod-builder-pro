import { describe, it, expect, vi } from 'vitest'

// We import the loader from the unified stream route and mock prisma.
// The loader returns a Response whose body is a ReadableStream we can consume.

vi.mock('../db.server', () => {
  const importRun = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      status: 'discover',
      progress: {
        percent: 5,
        phase: 'discover',
        details: { seedIndex: 1, seedsTotal: 10 },
        lastUpdated: new Date().toISOString(),
      },
      summary: {},
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })),
  }
  const importLog = {
    findUnique: vi.fn(async () => null),
    findMany: vi.fn(async () => [
      { id: 'log1', runId: 'r1', type: 'info', at: new Date().toISOString(), payload: 'hello' },
    ]),
  }
  return { prisma: { importRun, importLog } }
})

import { loader } from '../routes/api.importer.runs.$runId.stream'
import type { LoaderFunctionArgs } from '@remix-run/node'

// Helper to read SSE events from a Response body
async function collectEvents(res: Response, limit = 5): Promise<Array<{ event: string; data: unknown }>> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  const events: Array<{ event: string; data: unknown }> = []
  let buf = ''
  while (events.length < limit) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value)
    // Split on double newlines (SSE record boundary)
    const parts = buf.split(/\n\n/)
    // Keep last partial in buffer
    buf = parts.pop() || ''
    for (const rec of parts) {
      const lines = rec.split(/\n/).filter(Boolean)
      let ev: string | null = null
      let dataRaw = ''
      for (const ln of lines) {
        if (ln.startsWith('event:')) ev = ln.slice(6).trim()
        if (ln.startsWith('data:')) dataRaw += ln.slice(5).trim()
      }
      if (ev) {
        try {
          const parsed = dataRaw ? JSON.parse(dataRaw) : null
          events.push({ event: ev, data: parsed })
        } catch {
          events.push({ event: ev, data: dataRaw })
        }
      }
    }
  }
  try {
    reader.releaseLock()
  } catch {
    /* ignore */
  }
  return events
}

describe('Unified importer stream', () => {
  it('emits progress and log events', async () => {
    const request = new Request('http://localhost/api/importer/runs/r1/stream?hq=1')
    const params = { runId: 'r1' }
    const res = await loader({ request, params, context: {} as unknown } as LoaderFunctionArgs)
    expect(res.status).toBe(200)
    const events = await collectEvents(res, 4)
    const types = events.map(e => e.event)
    expect(types).toContain('progress')
    expect(types).toContain('log')
    // progress payload shape
    const progressEvt = events.find(e => e.event === 'progress')
    expect(progressEvt?.data).toMatchObject({ runId: 'r1', status: 'discover' })
    const logEvt = events.find(e => e.event === 'log')
    expect(logEvt?.data).toMatchObject({ logs: [{ id: 'log1', type: 'info' }] })
  })
})
