import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'

// /healthz - versioned health + timestamp for external monitoring.
// Uses .tsx extension so Remix treats it as a standard route module even with a trivial component.
export async function loader(_: LoaderFunctionArgs) {
  const version = process.env.APP_COMMIT || process.env.COMMIT_SHA || null
  return json({ ok: true, version, ts: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}

export default function Healthz() {
  return null
}
