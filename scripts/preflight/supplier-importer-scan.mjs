// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
// Simple scanner: fail if any client-side code (app/components, routes) uses fetch/http(s) to non-app domains directly.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../app', import.meta.url).pathname
const offenders = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(tsx?|jsx?)$/.test(entry)) {
      const text = readFileSync(p, 'utf8')
      if (/fetch\(['"`]https?:\/\//.test(text) && !/importer\//.test(p)) {
        offenders.push(p)
      }
    }
  }
}
walk(root)
if (offenders.length) {
  console.error('[supplier-importer] Preflight failed: direct external fetch usage in client code:')
  offenders.forEach(o => console.error(' -', o))
  process.exit(1)
} else {
  console.log('[supplier-importer] Preflight PASS')
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
