// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/**
 * Preflight: importer-v2-3
 * Checks:
 *  - Required files exist
 *  - Sentinels present in target files
 *  - State enum has all 8 states
 *  - Design doc has Design-Lock header
 *  - Legacy templates route redirects to /app/imports
 * Exits 1 on any failure; prints PASS/FAIL table.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

// Helper
const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : null)
const ok = b => (b ? 'PASS' : 'FAIL')

const files = {
  routes: [
    'src/apps/admin.portal/app/routes/app.imports._index.tsx',
    'src/apps/admin.portal/app/routes/app.imports.new.tsx',
    'src/apps/admin.portal/app/routes/app.imports.$templateId.tsx',
    'src/apps/admin.portal/app/routes/app.imports.$templateId.schedule.tsx',
    'src/apps/admin.portal/app/routes/app.templates.$.tsx',
  ],
  components: [
    'src/apps/admin.portal/app/components/importer/ImportList.tsx',
    'src/apps/admin.portal/app/components/importer/GlobalLogList.tsx',
    'src/apps/admin.portal/app/components/importer/ScheduleForm.tsx',
    'src/apps/admin.portal/app/components/importer/ShopifyFilterLink.tsx',
    'src/apps/admin.portal/app/components/importer/ApproveAbortControls.tsx',
    'src/apps/admin.portal/app/components/importer/ImportRowStateBadge.tsx',
  ],
  state: ['src/apps/admin.portal/app/state/importerMachine.ts'],
  designDoc: 'docs/design/importer-v2-3.md',
}

const MUST_HAVE_STATES = [
  'NEEDS_SETTINGS',
  'READY_TO_TEST',
  'IN_TEST',
  'READY_TO_APPROVE',
  'APPROVED',
  'SCHEDULED',
  'ABORTED',
  'FAILED',
]

let failures = []

function checkExists(p) {
  const exists = existsSync(p)
  if (!exists) failures.push(`Missing file: ${p}`)
  return exists
}

function checkSentinel(p) {
  const content = read(p)
  const has = content ? content.includes('BEGIN RBP GENERATED: importer-v2-3') : false
  if (!has) failures.push(`Missing sentinel in: ${p}`)
  return has
}

function checkEnumStates(p) {
  const content = read(p) || ''
  // tolerant match across whitespace/newlines
  const enumBlock = content.match(/export\s+enum\s+ImportState\s*{([\s\S]*?)}/)
  if (!enumBlock) {
    failures.push(`ImportState enum not found in: ${p}`)
    return false
  }
  const block = enumBlock[1]
  const missing = MUST_HAVE_STATES.filter(s => !new RegExp(`\\b${s}\\b`).test(block))
  if (missing.length) {
    failures.push(`ImportState missing: ${missing.join(', ')} in ${p}`)
    return false
  }
  return true
}

function checkDesignLock(p) {
  const content = read(p) || ''
  const hasLock = content.includes('Design-Lock: importer-v2-3')
  if (!hasLock) failures.push(`Design-Lock header missing in: ${p}`)
  return hasLock
}

function checkTemplatesRedirect(p) {
  const content = read(p) || ''
  // Just ensure we reference /app/imports in the legacy template route
  const mentionsImports = content.includes('/app/imports')
  if (!mentionsImports) failures.push(`Legacy templates route should redirect to /app/imports: ${p}`)
  return mentionsImports
}

// Run checks
const rows = []

// Routes
for (const f of files.routes) {
  const p = path.join(root, f)
  rows.push([f, ok(checkExists(p))])
}
for (const f of files.routes) {
  const p = path.join(root, f)
  if (existsSync(p)) rows.push([`${f} (sentinel)`, ok(checkSentinel(p))])
}
// Components
for (const f of files.components) {
  const p = path.join(root, f)
  rows.push([f, ok(checkExists(p))])
}
for (const f of files.components) {
  const p = path.join(root, f)
  if (existsSync(p)) rows.push([`${f} (sentinel)`, ok(checkSentinel(p))])
}
// State
for (const f of files.state) {
  const p = path.join(root, f)
  rows.push([f, ok(checkExists(p))])
  if (existsSync(p)) {
    rows.push([`${f} (sentinel)`, ok(checkSentinel(p))])
    rows.push([`${f} (enum)`, ok(checkEnumStates(p))])
  }
}
// Design doc
{
  const p = path.join(root, files.designDoc)
  rows.push([files.designDoc, ok(checkExists(p))])
  if (existsSync(p)) rows.push([`${files.designDoc} (Design-Lock)`, ok(checkDesignLock(p))])
}
// Legacy redirect
{
  const p = path.join(root, 'src/apps/admin.portal/app/routes/app.templates.$.tsx')
  if (existsSync(p)) rows.push(['Legacy templates redirect', ok(checkTemplatesRedirect(p))])
}

// Print report
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n)
const maxName = Math.max(...rows.map(r => r[0].length), 28)
console.log('\nPreflight: importer-v2-3\n' + '-'.repeat(maxName + 10))
rows.forEach(([name, status]) => {
  console.log(`${pad(name, maxName)}  ${status}`)
})
if (failures.length) {
  console.log('\nFailures:')
  failures.forEach(f => console.log(' - ' + f))
  process.exit(1)
}
console.log('\nAll checks PASS ✅')
process.exit(0)
// <!-- END RBP GENERATED: importer-v2-3 -->
