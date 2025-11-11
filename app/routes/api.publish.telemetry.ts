import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { prisma } from '../db.server'

type PublishTelemetryRow = {
  id: string
  attempted: number
  created: number
  updated: number
  skipped: number
  failed: number
  startedAt: string | Date
  finishedAt: string | Date | null
  durationMs: number | null
}

// GET /api/publish/telemetry?limit=20
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? '20') || 20, 100))
  try {
    const rows = await prisma.$queryRawUnsafe<Array<PublishTelemetryRow>>(
      `SELECT id, attempted, created, updated, skipped, failed, startedAt, finishedAt, durationMs
         FROM PublishTelemetry
        ORDER BY startedAt DESC
        LIMIT ?`,
      limit,
    )
    return json({ ok: true, items: rows })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'query failed'
    return json({ ok: false, error: message }, { status: 500 })
  }
}
