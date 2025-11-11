import { json } from '@remix-run/node'

// Simple health endpoint for external monitoring and quick version checks.
// Needs a default export because this is a standard route (not a resource.* route)
// and data-only routes without a component are currently ignored by the build.
export async function loader() {
  const version = process.env.APP_COMMIT || process.env.COMMIT_SHA || null
  return json({ ok: true, version, ts: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}

// Data-only route: no UI needed.
export default function Healthz() {
  return null
}
