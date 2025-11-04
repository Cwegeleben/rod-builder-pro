#!/usr/bin/env node
/**
 * Dry-run importer prepare via smoke endpoints.
 *
 * Env vars:
 * - SMOKE_BASE: Base URL, e.g. https://your-app.fly.dev
 * - SMOKE_TOKEN: Token matching SMOKE_TOKEN on the server
 * - TARGET: Target id (e.g., batson-rod-blanks)
 * - SEEDS: Comma-separated URLs (or newline-separated)
 * - TEMPLATE_ID: Optional template id (if provided, TARGET/SEEDS inferred from saved settings)
 * - DURATION_SEC: Optional poll duration (default: 60)
 */

const BASE = process.env.SMOKE_BASE || ''
const TOKEN = process.env.SMOKE_TOKEN || ''
const TARGET = process.env.TEMPLATE_ID ? '' : (process.env.TARGET || '')
const RAW_SEEDS = process.env.TEMPLATE_ID ? '' : (process.env.SEEDS || '')
const TEMPLATE_ID = process.env.TEMPLATE_ID || ''
const DURATION_SEC = Number(process.env.DURATION_SEC || '60')

function fail(msg) {
  console.error(`[dry-run] ${msg}`)
  process.exit(1)
}

if (!BASE) fail('SMOKE_BASE is required')
if (!TOKEN) fail('SMOKE_TOKEN is required')
if (!TEMPLATE_ID && !TARGET) fail('Either TEMPLATE_ID or TARGET must be provided')

const seedsCsv = (() => {
  if (TEMPLATE_ID) return ''
  const raw = RAW_SEEDS.replace(/\n/g, ',')
  const items = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (!items.length) fail('SEEDS must include at least one URL')
  return encodeURIComponent(items.join(','))
})()

const q = TEMPLATE_ID
  ? `templateId=${encodeURIComponent(TEMPLATE_ID)}`
  : `target=${encodeURIComponent(TARGET)}&seeds=${seedsCsv}`

async function getJson(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(TOKEN)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function start() {
  console.log(`[dry-run] launching prepare…`)
  const res = await getJson(`/resources.smoke.importer.prepare?${q}`)
  if (!res?.ok || !res?.runId) throw new Error(`failed to start: ${JSON.stringify(res)}`)
  const runId = res.runId
  console.log(`[dry-run] runId=${runId} supplierId=${res.supplierId}`)

  const until = Date.now() + DURATION_SEC * 1000
  let last = { stagedCount: 0, diffCount: 0 }
  while (Date.now() < until) {
    try {
  const exp = await getJson(`/resources.smoke.importer.run-expected?runId=${encodeURIComponent(runId)}`)
  const stats = await getJson(`/resources.smoke.importer.run-stats?runId=${encodeURIComponent(runId)}`)
      const sc = Number(exp?.stagedCount || 0)
      const dc = Number(exp?.diffCount || 0)
      const ei = exp?.expectedItems ?? null
      const changed = sc !== last.stagedCount || dc !== last.diffCount
      if (changed) {
        last = { stagedCount: sc, diffCount: dc }
        const byType = stats?.counts ? ` counts=${JSON.stringify(stats.counts)}` : ''
        console.log(`[dry-run] staged=${sc} diffs=${dc}` + (ei != null ? ` expectedItems=${ei}` : '') + byType)
        if (dc > 0) {
          console.log(`[dry-run] diffs detected → review at /app/imports/runs/${runId}/review (with HQ session)`) 
        }
      }
      // small sleep
      await new Promise(r => setTimeout(r, 1000))
    } catch (e) {
      console.warn(`[dry-run] poll error: ${(e && e.message) || e}`)
      await new Promise(r => setTimeout(r, 1500))
    }
  }
  console.log('[dry-run] finished polling')
}

start().catch(err => fail(err?.message || String(err)))
