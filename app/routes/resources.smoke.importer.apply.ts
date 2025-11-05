import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    guardSmokeRoute({ request } as LoaderFunctionArgs)
    const url = new URL(request.url)
    const runId = url.searchParams.get('runId')
    if (!runId) return new Response('Missing runId', { status: 400 })

    // Lazy import prisma to avoid constructor-time failures; use raw SQL to minimize JSON parsing issues
    const { prisma } = await import('../db.server')

    // Read current status using raw SQL (ImportRun may be created via smoke start with TEXT json columns)
    const rows = (await prisma.$queryRawUnsafe('SELECT status FROM ImportRun WHERE id = ? LIMIT 1', runId)) as Array<{
      status: string
    }>

    if (!rows || rows.length === 0) return new Response('Not Found', { status: 404 })

    const current = rows[0]?.status || ''
    const alreadyApplied = current === 'success'
    if (!alreadyApplied) {
      await prisma.$executeRawUnsafe(
        'UPDATE ImportRun SET status = ?, finishedAt = CURRENT_TIMESTAMP WHERE id = ?',
        'success',
        runId,
      )
    }
    return json({ ok: true, runId, action: 'applied', changed: alreadyApplied ? 0 : 1 })
  } catch (e) {
    const msg = (e as Error)?.message || 'Unexpected error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export const handle = { private: true }
