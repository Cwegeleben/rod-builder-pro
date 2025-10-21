// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
/** Lightweight URL state helpers for filters/sorting/pagination saved in query params. */
export function getParams(url: string | URL): URLSearchParams {
  const u = typeof url === 'string' ? new URL(url, 'http://local') : url
  return new URLSearchParams(u.search)
}

export function setParam(search: URLSearchParams, key: string, value: string | undefined) {
  if (value && value.length) search.set(key, value)
  else search.delete(key)
}

export function toQuery(obj: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    const s = typeof v === 'number' ? String(v) : v
    setParam(sp, k, s)
  }
  return `?${sp.toString()}`
}

export function mergeQuery(current: URLSearchParams, update: Record<string, string | number | undefined | null>) {
  const next = new URLSearchParams(current)
  for (const [k, v] of Object.entries(update)) {
    if (v == null) next.delete(k)
    else setParam(next, k, typeof v === 'number' ? String(v) : (v as string))
  }
  return next
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
