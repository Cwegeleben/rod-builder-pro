// <!-- BEGIN RBP GENERATED: admin-link-integrity-v1 -->
/**
 * Preflight: Admin Link Integrity & Nav Unification
 * - Verifies canonical importer routes exist
 * - Ensures legacy alias/legacy routes redirect (no UI)
 * - Warns if NavMenu is missing canonical entries
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const routesDir = path.join(root, 'app', 'routes')

function hasFile(rel: string) {
  return fs.existsSync(path.join(routesDir, rel))
}

function read(rel: string) {
  try {
    return fs.readFileSync(path.join(routesDir, rel), 'utf8')
  } catch {
    return ''
  }
}

function fail(msg: string) {
  console.error(`[admin-links] FAIL: ${msg}`)
  process.exitCode = 1
}

function warn(msg: string) {
  console.warn(`[admin-links] WARN: ${msg}`)
}

// 1) Canonical pages presence
const canonical = [
  'app.admin.import.runs._index.tsx',
  'app.admin.import.runs.$runId.tsx',
  'app.admin.import.new.tsx',
  'app.admin.import.$runId.edit.tsx',
  'app.admin.import.preview.$runId.tsx',
  'app.admin.import.apply-run.tsx',
  'app.admin.import.settings.tsx',
  'app.admin.import.settings._index.tsx',
  'app.admin.import.refresh-price.tsx',
]
const missingCanonical = canonical.filter(f => !hasFile(f))
if (missingCanonical.length) fail(`Missing canonical route files: ${missingCanonical.join(', ')}`)

// 2) Legacy/alias routes must redirect
const legacyPatterns = [/^hq\.import.*\.tsx$/, /^app\.imports.*\.tsx$/, /^app\.products\.import.*\.tsx$/]
const legacyFiles = fs.readdirSync(routesDir).filter(name => legacyPatterns.some(rx => rx.test(name)))
const legacyBad = legacyFiles.filter(name => {
  const src = read(name)
  // Consider safe if a loader returns redirect; flag if no redirect present
  return !/redirect\s*\(/.test(src)
})
if (legacyBad.length) fail(`Legacy routes not redirecting: ${legacyBad.join(', ')}`)

// 3) NavMenu check (app.tsx)
const appTsx = read('app.tsx')
if (!/admin\/import\/runs/.test(appTsx) || !/admin\/import\/settings/.test(appTsx)) {
  warn('NavMenu is missing canonical Import Runs or Settings entries (app/routes/app.tsx)')
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('[admin-links] One or more checks failed')
  process.exit(process.exitCode)
} else {
  console.log('[admin-links] OK')
}
// <!-- END RBP GENERATED: admin-link-integrity-v1 -->
