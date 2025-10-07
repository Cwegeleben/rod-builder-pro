// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
// Fails if code contains console.log of password or decrypted secrets.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../app', import.meta.url).pathname
const offenders = []
const pattern = /(console\.log\(.*password)|(password\s*[:=]\s*['"][^'"]+['"])/i

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(t|j)sx?$/.test(e)) {
      const txt = readFileSync(p, 'utf8')
      if (pattern.test(txt)) offenders.push(p)
    }
  }
}
walk(root)
if (offenders.length) {
  console.error('[inventory-auth] Preflight FAIL: plain password usage detected:')
  offenders.forEach(o => console.error(' -', o))
  process.exit(1)
} else {
  console.log('[inventory-auth] Preflight PASS')
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
