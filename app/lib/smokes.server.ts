import type { LoaderFunctionArgs } from '@remix-run/node'

/** Returns true if smoke endpoints are enabled via ENABLE_SMOKES env var. */
export function smokesEnabled(): boolean {
  const v = process.env.ENABLE_SMOKES || ''
  const norm = v.trim().toLowerCase()
  return norm === '1' || norm === 'true' || norm === 'on' || norm === 'enabled' || norm === 'yes'
}

/** Extracts a bearer/query token from the request. */
export function extractSmokeToken(request: Request): string | null {
  const url = new URL(request.url)
  const qp = url.searchParams.get('token')
  if (qp) return qp
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

/** Throws 404 if smokes are disabled. */
export function requireSmokesEnabled(): void {
  if (!smokesEnabled()) throw new Response('Not Found', { status: 404 })
}

/** Throws 403 if the provided token does not match SMOKE_TOKEN. */
export function requireSmokeAuth(request: Request): void {
  const token = extractSmokeToken(request)
  const expected = process.env.SMOKE_TOKEN || 'smoke-ok'
  if (!token || token !== expected) throw new Response('Forbidden', { status: 403 })
}

/** Convenience guard to call at the top of a smoke route loader/action. */
export function guardSmokeRoute(args: LoaderFunctionArgs): void {
  requireSmokesEnabled()
  requireSmokeAuth(args.request)
}
