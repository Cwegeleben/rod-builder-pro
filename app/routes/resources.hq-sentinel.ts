import { json } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url)
  const allowOverride = process.env.ALLOW_HQ_OVERRIDE === '1'
  const cookie = request.headers.get('cookie') || ''
  const signals = {
    query: url.searchParams.get('hq') === '1',
    cookie: /(?:^|;\s*)rbp_hq=1(?:;|$)/.test(cookie),
    header: request.headers.get('x-hq-override') === '1',
  }

  const isHq = await isHqShop(request)
  return json({ isHq, allowOverride, signals }, { headers: { 'Cache-Control': 'no-store' } })
}
