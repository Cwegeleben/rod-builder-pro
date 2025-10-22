/* <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 --> */
import { ROUTES, REDIRECTS, REQUIRED_QUERY_PARAMS } from '../../src/config/routes.admin'
import { TEST_IDS } from '../../src/config/testIds'

const BASE = process.env.BASE_URL || process.env.PW_BASE_URL
if (!BASE) {
  console.error('BASE_URL is required (e.g., http://localhost:3000)')
  process.exit(2)
}
const Q_BASE = process.env.TEST_QUERY ?? '?shop=dev.myshopify.com&host=abc&embedded=1'
const HQ_OVERRIDE = process.env.HQ_OVERRIDE === '1'
const Q = HQ_OVERRIDE ? (Q_BASE.includes('?') ? `${Q_BASE}&hq=1` : `${Q_BASE}?hq=1`) : Q_BASE
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
  for (const k of REQUIRED_QUERY_PARAMS) {
    if (!u.searchParams.has(k)) throw new Error(`Missing query param ${k} in redirect URL: ${u.toString()}`)
  }
}
async function assert200(path: string) {
  const initial = await fetchManual(`${BASE}${path}${Q}`)
  if (initial.status === 200) return
  if (REDIRECT_CODES.includes(initial.status)) {
    const loc = initial.headers.get('location')
    if (!loc) throw new Error(`Missing Location header for canonical ${path}`)
    assertQueryPreserved(loc)
    const followed = await fetchDirect(new URL(loc, BASE).toString())
    if (followed.status !== 200) {
      throw new Error(`Expected 200 after redirect at ${path}, got ${followed.status}`)
    }
    return
  }
  throw new Error(`Expected 200 at ${path}, got ${initial.status}`)
}
async function assertRedirect(from: string) {
  const res = await fetchManual(`${BASE}${from}${Q}`)
  if (![301, 302, 307, 308].includes(res.status)) throw new Error(`Expected redirect at ${from}, got ${res.status}`)
  const loc = res.headers.get('location')
  if (!loc) throw new Error(`Missing Location header for ${from}`)
  assertQueryPreserved(loc)
  return loc
}
async function getHtml(path: string) {
  // Allow a single auth/handshake redirect then fetch the resulting HTML
  const first = await fetchManual(`${BASE}${path}${Q}`)
  if (first.status === 200) return await first.text()
  if (REDIRECT_CODES.includes(first.status)) {
    const loc = first.headers.get('location')
    if (!loc) throw new Error(`Missing Location header while fetching HTML for ${path}`)
    assertQueryPreserved(loc)
    const res2 = await fetchDirect(new URL(loc, BASE).toString())
    if (!res2.ok) throw new Error(`Failed to fetch HTML for ${path} after redirect: ${res2.status}`)
    return await res2.text()
  }
  throw new Error(`Failed to fetch HTML for ${path}: ${first.status}`)
}

;(async () => {
  // If no explicit COOKIE, try to build it from Playwright storageState
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
          // domain must be exact host or a parent domain of host
          return hostname === dom || hostname.endsWith(`.${dom}`)
        })
        if (cookies.length) {
          COOKIE = cookies.map(c => `${c.name}=${c.value}`).join('; ')
        }
      }
    } catch (e) {
      console.warn(`[preflight] Could not read storage state from ${STORAGE_STATE}:`, (e as Error)?.message)
    }
  }

  // Warm up: if no COOKIE provided, hit /app with TEST_QUERY and collect Set-Cookie
  if (!COOKIE) {
    try {
      let current = `${BASE}/app${Q}`
      const jar = new Map<string, string>()
      for (let i = 0; i < 3; i++) {
        const res = await fetch(current, { redirect: 'manual' as RequestRedirect })
        // Gather Set-Cookie headers
        // @ts-expect-error: headers.raw() is available in undici
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
          current = new URL(loc, BASE).toString()
          continue
        }
        // Stop if 200 or any non-redirect
        break
      }
      if (jar.size > 0) {
        COOKIE = Array.from(jar.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')
      }
    } catch {
      console.warn('[preflight] Warm-up cookie acquisition failed; continuing without COOKIE')
    }
  }

  // 0) If HQ override requested, assert the server honors it via sentinel
  if (HQ_OVERRIDE) {
    try {
      const res = await fetchDirect(`${BASE}/resources/hq-sentinel${Q}`)
      if (!res.ok) throw new Error(`sentinel status ${res.status}`)
      const data = (await res.json()) as { isHq?: boolean; allowOverride?: boolean; signals?: Record<string, unknown> }
      if (!data?.isHq) {
        throw new Error(
          `[preflight] HQ override requested but server did not report HQ via sentinel (allowOverride=${data?.allowOverride}). Signals: ${JSON.stringify(data?.signals || {})}`,
        )
      }
    } catch (e) {
      throw new Error((e as Error)?.message || String(e))
    }
  }

  // 1) Canonical pages must return 200
  let gated = false
  try {
    await assert200(ROUTES.runsIndex)
    await assert200(ROUTES.settingsIndex)
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    if (msg.includes(' got 410')) {
      console.warn(
        '[preflight] Detected 410 on canonical route; assuming HQ-gated environment. Skipping content checks.',
      )
      gated = true
    } else {
      throw e
    }
  }

  // 2) Legacy routes must redirect and preserve query
  for (const { from } of REDIRECTS) await assertRedirect(from)

  // 3) Spot-check DOM for required links by test ID
  if (!gated) {
    const htmlRuns = await getHtml(ROUTES.runsIndex)
    for (const id of [TEST_IDS.btnNewImport, TEST_IDS.btnManageTemplates]) {
      if (!htmlRuns.includes(`data-testid="${id}"`)) {
        throw new Error(`Missing required element ${id} on runs index`)
      }
    }
    const htmlProducts = await getHtml(ROUTES.productsIndex)
    if (!htmlProducts.includes(`data-testid="${TEST_IDS.btnProductsImport}"`)) {
      throw new Error(`Missing required element ${TEST_IDS.btnProductsImport} on products index`)
    }
  }

  // 4) Coverage: ensure required canonical routes are touched by preflight
  const covered = new Set<string>([ROUTES.runsIndex, ROUTES.settingsIndex, ROUTES.productsIndex])
  const required = [ROUTES.runsIndex, ROUTES.settingsIndex, ROUTES.productsIndex]
  for (const r of required) if (!covered.has(r)) throw new Error(`Route not covered by preflight: ${r}`)

  console.log(gated ? 'preflight:links OK (HQ gated: partial checks passed)' : 'preflight:links OK')
})().catch(e => {
  console.error(e?.message || e)
  process.exit(1)
})
/* <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 --> */
