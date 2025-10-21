import { json } from '@remix-run/node'

// Lightweight health endpoint for Fly.io HTTP checks
export async function loader() {
  return json({ ok: true, ts: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
