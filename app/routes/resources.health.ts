import { json } from '@remix-run/node'

// Lightweight health endpoint for Fly.io HTTP checks
export async function loader() {
  const version = process.env.APP_COMMIT || process.env.COMMIT_SHA || null
  return json({ ok: true, version, ts: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
