import { json } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url)
  const allowOverride = process.env.ALLOW_HQ_OVERRIDE === '1'
  const allowImplicitDev =
    typeof process !== 'undefined' && process.env.NODE_ENV !== 'production' && process.env.ALLOW_HQ_OVERRIDE !== '0'
  const allowBypass = allowOverride || allowImplicitDev || Boolean(process.env.HQ_BYPASS_TOKEN)
  const cookie = request.headers.get('cookie') || ''
  const signals = {
    query: url.searchParams.get('hq') === '1' || url.searchParams.get('hqBypass') === '1',
    cookie: /(?:^|;\s*)rbp_hq=1(?:;|$)/.test(cookie) || /(?:^|;\s*)rbp_hq_bypass=1(?:;|$)/.test(cookie),
    header: request.headers.get('x-hq-override') === '1' || request.headers.get('x-hq-bypass') === '1',
    token: Boolean(process.env.HQ_BYPASS_TOKEN && request.headers.get('x-hq-bypass') === process.env.HQ_BYPASS_TOKEN),
  }

  const isHq = await isHqShop(request)
  return json({ isHq, allowOverride: allowBypass, signals }, { headers: { 'Cache-Control': 'no-store' } })
}
