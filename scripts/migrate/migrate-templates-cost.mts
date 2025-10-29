/* <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 --> */
export {}
// Simple runner to trigger migrateCostTopLevelToField via server resource route
const BASE = process.env.BASE_URL || process.env.PW_BASE_URL
if (!BASE) {
  console.error('BASE_URL is required (e.g., https://rbp-app.fly.dev)')
  process.exit(2)
}
const Q_BASE = process.env.TEST_QUERY ?? '?shop=dev.myshopify.com&host=abc&embedded=1'
let COOKIE = process.env.COOKIE || ''
const REDIRECT_CODES = [301, 302, 307, 308]

async function fetchManual(url: string) {
  const headers: Record<string, string> = {}
  if (COOKIE) headers['cookie'] = COOKIE
  return await fetch(url, { redirect: 'manual' as RequestRedirect, headers })
}
function assertQueryPreserved(url: string) {
  const u = new URL(url, BASE)
  for (const k of ['embedded', 'hmac', 'host', 'id_token', 'locale', 'session', 'shop', 'timestamp']) {
    if (!u.searchParams.has(k)) throw new Error(`Missing query param ${k} in redirect URL: ${u.toString()}`)
  }
}
async function warmCookies() {
  if (COOKIE) return
  try {
    let current = `${BASE}/app${Q_BASE}`
    for (let i = 0; i < 3; i++) {
      const res = await fetchManual(current)
      if (REDIRECT_CODES.includes(res.status)) {
        const loc = res.headers.get('location')
        if (!loc) break
        assertQueryPreserved(loc)
        current = new URL(loc, BASE).toString()
        continue
      }
      break
    }
    // capture simple cookie if provided
    const single = (await fetchManual(current)).headers.get('set-cookie')
    if (single) COOKIE = single.split(';')[0]
  } catch {
    // ignore
  }
}

;(async () => {
  await warmCookies()
  const endpoint = new URL('/resources/spec-templates', BASE)
  endpoint.search = new URLSearchParams(new URL(`x://x/${Q_BASE}`).search).toString()
  const form = new URLSearchParams({ _action: 'migrateCostTopLevelToField' })
  const res = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(COOKIE ? { cookie: COOKIE } : {}) },
    body: form.toString(),
  })
  if (!res.ok) {
    console.error('migrateCostTopLevelToField failed', res.status)
    process.exit(1)
  }
  const json = await res.json()
  console.log('migrate:templates-cost', json)
})().catch(e => {
  console.error(e?.message || e)
  process.exit(1)
})
/* <!-- END RBP GENERATED: importer-templates-orphans-v1 --> */
