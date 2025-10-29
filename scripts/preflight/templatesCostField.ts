/* <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 --> */
export {}
// Preflight: ensure primary_variant_cost exists when price exists; and UI removed legacy top-level cost action
const BASE = process.env.BASE_URL || process.env.PW_BASE_URL
if (!BASE) {
  console.error('BASE_URL is required (e.g., https://rbp-app.fly.dev)')
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
function assertQueryPreserved(url: string) {
  const u = new URL(url, BASE)
  for (const k of ['embedded', 'hmac', 'host', 'id_token', 'locale', 'session', 'shop', 'timestamp']) {
    if (!u.searchParams.has(k)) throw new Error(`Missing query param ${k} in redirect URL: ${u.toString()}`)
  }
}
async function warmCookies() {
  if (COOKIE) return
  // Try to load from Playwright storage state first
  try {
    const { existsSync, readFileSync } = await import('node:fs')
    const { hostname } = new URL(BASE!)
    if (existsSync(STORAGE_STATE)) {
      type Cookie = { name: string; value: string; domain?: string; path?: string }
      const state = JSON.parse(readFileSync(STORAGE_STATE, 'utf-8')) as { cookies?: Cookie[] }
      const cookies = (state.cookies || []).filter(c => {
        if (!c.domain) return false
        const dom = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain
        return hostname === dom || hostname.endsWith(`.${dom}`)
      })
      if (cookies.length) {
        COOKIE = cookies.map(c => `${c.name}=${c.value}`).join('; ')
        return
      }
    }
  } catch {
    // ignore
  }
  try {
    let current = `${BASE}/app${Q_BASE}`
    const jar = new Map<string, string>()
    for (let i = 0; i < 3; i++) {
      const res = await fetchManual(current)
      // @ts-expect-error raw() is available in undici's Headers implementation used by node-fetch
      const rawSet: string[] | undefined = res.headers.raw?.()?.['set-cookie'] || undefined
      const single = res.headers.get('set-cookie')
      const all = rawSet ?? (single ? [single] : [])
      for (const sc of all) {
        const pair = sc.split(';')[0]
        const eq = pair.indexOf('=')
        if (eq > 0) {
          const name = pair.slice(0, eq).trim()
          const val = pair.slice(eq + 1).trim()
          if (name && val) jar.set(name, val)
        }
      }
      if (REDIRECT_CODES.includes(res.status)) {
        const loc = res.headers.get('location')
        if (!loc) break
        assertQueryPreserved(loc)
        current = new URL(loc, BASE).toString()
        continue
      }
      break
    }
    if (jar.size > 0) {
      COOKIE = Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    }
  } catch {
    // ignore
  }
}

;(async () => {
  await warmCookies()
  // 1) Query remote metaobjects via server API
  const api = new URL('/api/importer/templates?kind=variant-remote', BASE)
  api.search = new URLSearchParams(new URL(`x://x/${Q_BASE}`).search).toString()
  const res = await fetchDirect(api.toString())
  if (!res.ok) {
    if (res.status === 404 || res.status === 410) {
      console.log('[preflight] variant-remote gated; skipping deep checks')
      console.log('preflight:templates-cost-field OK (HQ gated)')
      process.exit(0)
    }
    throw new Error(`variant-remote API ${res.status}`)
  }
  const rows = (await res.json()) as Array<{ id: string; hasPrice: boolean; hasPrimaryVariantCost: boolean }>
  const missing = rows.filter(r => r.hasPrice && !r.hasPrimaryVariantCost)
  if (missing.length) {
    throw new Error(
      `Templates missing core cost mapping (variants[0].inventoryItem.cost): ${missing.map(m => m.id).join(', ')}`,
    )
  }

  // 2) UI sanity: ensure legacy action is not present on templates detail (no updatePrimaryVariantCost)
  // Fetch index to get first template id
  const listUrl = new URL('/app/products/templates', BASE)
  listUrl.search = new URLSearchParams(new URL(`x://x/${Q_BASE}`).search).toString()
  const listRes = await fetchManual(listUrl.toString())
  let html: string | undefined
  if (listRes.status === 200) html = await listRes.text()
  else if (REDIRECT_CODES.includes(listRes.status)) {
    const loc = listRes.headers.get('location')
    if (!loc) throw new Error('Missing Location for templates index')
    const res2 = await fetchDirect(new URL(loc, BASE).toString())
    if (!res2.ok) throw new Error(`Templates index after redirect ${res2.status}`)
    html = await res2.text()
  } else {
    throw new Error(`Templates index ${listRes.status}`)
  }
  if (html && html.includes('updatePrimaryVariantCost')) {
    throw new Error('Legacy cost default UI/action still referenced (updatePrimaryVariantCost)')
  }
  console.log('preflight:templates-cost-field OK')
})().catch(e => {
  console.error(e?.message || e)
  process.exit(1)
})
/* <!-- END RBP GENERATED: importer-templates-orphans-v1 --> */
