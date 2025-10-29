/* <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 --> */
// Preflight: Admin Templates orphan sync check
// - Navigates to the Templates index with view=orphans and embedded query from env
// - Fails if any orphan(s) are reported in the banner

const BASE = process.env.BASE_URL || process.env.PW_BASE_URL
if (!BASE) {
  console.error('BASE_URL is required (e.g., http://localhost:3000)')
  process.exit(2)
}
const Q_BASE = process.env.TEST_QUERY ?? '?shop=dev.myshopify.com&host=abc&embedded=1'
let COOKIE = process.env.COOKIE || ''
const STORAGE_STATE = process.env.PW_STORAGE_STATE || 'tests/.auth/state.json'

const REDIRECT_CODES = [301, 302, 307, 308]

async function fetchManual(url: string) {
  const headers: Record<string, string> = {}
  if (COOKIE) headers['cookie'] = COOKIE
  return await fetch(url, { redirect: 'manual' as RequestRedirect, headers })
}

async function fetchDirect(url: string) {
  const headers: Record<string, string> = {}
  if (COOKIE) headers['cookie'] = COOKIE
  return await fetch(url, { headers })
}

async function getHtml(path: string) {
  const first = await fetchManual(`${BASE}${path}${Q_BASE.includes('?') ? Q_BASE + '&' : Q_BASE + '?'}view=orphans`)
  if (first.status === 410) {
    // HQ-gated environment: treat as pass (cannot introspect templates page)
    return '<!-- gated -->'
  }
  if (first.status === 200) return await first.text()
  if (REDIRECT_CODES.includes(first.status)) {
    const loc = first.headers.get('location')
    if (!loc) throw new Error(`Missing Location header while fetching HTML for ${path}`)
    const res2 = await fetchDirect(new URL(loc, BASE).toString())
    if (!res2.ok) throw new Error(`Failed to fetch HTML for ${path} after redirect: ${res2.status}`)
    return await res2.text()
  }
  throw new Error(`Failed to fetch HTML for ${path}: ${first.status}`)
}

;(async () => {
  // Acquire cookies from Playwright storage state if available
  if (!COOKIE) {
    try {
      const { existsSync, readFileSync } = await import('node:fs')
      const { hostname } = new URL(BASE)
      if (existsSync(STORAGE_STATE)) {
        type Cookie = { name: string; value: string; domain?: string; path?: string }
        const state = JSON.parse(readFileSync(STORAGE_STATE, 'utf-8')) as { cookies?: Cookie[] }
        const cookies = (state.cookies || []).filter(c => {
          if (!c.domain) return false
          const dom = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain
          return hostname === dom || hostname.endsWith(`.${dom}`)
        })
        if (cookies.length) COOKIE = cookies.map(c => `${c.name}=${c.value}`).join('; ')
      }
    } catch (e) {
      console.warn(`[preflight] Could not read storage state from ${STORAGE_STATE}:`, (e as Error)?.message)
    }
  }

  // Fetch Templates index with orphan view
  const html = await getHtml('/app/products/templates')
  if (html.includes('<!-- gated -->')) {
    console.log('preflight:admin-templates-sync OK (HQ gated: skipping orphan scan)')
    return
  }
  // Heuristic: find banner phrase we render and extract orphan count
  const m = html.match(/Some published templates are hidden\.[^\d]*(\d+) orphan\(s\)/i)
  const count = m ? parseInt(m[1] || '0', 10) : 0
  if (Number.isFinite(count) && count > 0) {
    console.error(`preflight:admin-templates-sync FAIL — ${count} orphan metaobject(s) detected. Run Sync orphans.`)
    process.exit(1)
  }

  console.log('preflight:admin-templates-sync OK — no orphans detected')
})().catch(e => {
  console.error(e?.message || e)
  process.exit(1)
})
/* <!-- END RBP GENERATED: importer-templates-orphans-v1 --> */
