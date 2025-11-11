import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async (args: LoaderFunctionArgs) => {
  try {
    guardSmokeRoute(args)
    const { request } = args
    const { prisma } = await import('../db.server')
    const url = new URL(request.url)
    const runId = url.searchParams.get('runId')
    const count = Number(url.searchParams.get('count') || '3')
    if (!runId) return new Response('Missing runId', { status: 400 })

    // Ensure minimal ImportDiff table exists for smoke-only flows
    try {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS ImportDiff (id TEXT PRIMARY KEY NOT NULL, importRunId TEXT NOT NULL, externalId TEXT, diffType TEXT NOT NULL, before TEXT, after TEXT, resolution TEXT, resolvedAt DATETIME)',
      )
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportDiff_run_idx ON ImportDiff(importRunId)')
    } catch (e) {
      console.warn('[smoke:seed-diffs] ensure ImportDiff failed:', e)
    }

    const before = JSON.stringify({ title: 'Before', price: 10 })
    const after = JSON.stringify({ title: 'After', price: 12 })
    const ids: string[] = []
    await prisma.$transaction(async tx => {
      for (let i = 0; i < count; i++) {
        const id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
        await tx.$executeRawUnsafe(
          'INSERT INTO ImportDiff (id, importRunId, externalId, diffType, before, after) VALUES (?, ?, ?, ?, ?, ?)',
          id,
          runId,
          `ext-${Date.now()}-${i}`,
          'change',
          before,
          after,
        )
        ids.push(id)
      }
    })

    return json({ ok: true, ids })
  } catch (e) {
    const msg = (e as Error)?.message || 'Unexpected error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export const handle = { private: true }
