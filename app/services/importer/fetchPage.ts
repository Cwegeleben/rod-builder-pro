// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import { fetchRobotsTxt, isPathAllowed } from '../../config/robots'
import { throttle } from '../../config/throttle'

export interface FetchPageOptions {
  url: string
  userAgent?: string
  snapshotMaxLength?: number
}

export interface FetchedPage {
  url: string
  origin: string
  html: string
  truncated: boolean
  disallowed: boolean
}

export async function fetchPage(opts: FetchPageOptions): Promise<FetchedPage> {
  const url = new URL(opts.url)
  const origin = url.origin
  const robots = await fetchRobotsTxt(origin)
  const allowed = isPathAllowed(robots, url.pathname)
  if (!allowed) {
    return {
      url: url.toString(),
      origin,
      html: '',
      truncated: false,
      disallowed: true,
    }
  }
  await throttle(origin)
  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'User-Agent': opts.userAgent || 'RBP-Importer/1.0' },
  })
  const text = await resp.text()
  const max = opts.snapshotMaxLength ?? 200_000
  const truncated = text.length > max
  const html = truncated ? text.slice(0, max) : text
  return { url: url.toString(), origin, html, truncated, disallowed: false }
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
