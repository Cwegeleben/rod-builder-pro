#!/usr/bin/env node
/**
 * Single-seed start-to-finish: prepare -> approve adds -> publish (dry-run) with progress.
 *
 * Env vars:
 * - SMOKE_BASE      Required. e.g. https://your-app.fly.dev
 * - SMOKE_TOKEN     Required. Must match server smoke token
 * - SEED            Required when TEMPLATE_ID not set. Single URL (preferred) or comma/newline delimited
 * - TARGET          Optional when TEMPLATE_ID not set. E.g. batson-rod-blanks
 * - TEMPLATE_ID     Optional. If provided, settings are read from saved template (seed not required)
 * - APPROVE_LIMIT   Optional. Integer. Approve up to N ADD diffs (default: 20)
 * - TIMEOUT_SEC     Optional. Overall timeout for polling (default: 90)
 * - POLL_MS         Optional. Poll interval (default: 1000)
 */

const BASE = process.env.SMOKE_BASE || ''
const TOKEN = process.env.SMOKE_TOKEN || ''
const TEMPLATE_ID = process.env.TEMPLATE_ID || ''
const TARGET = TEMPLATE_ID ? '' : (process.env.TARGET || 'batson-rod-blanks')
const RAW_SEED = TEMPLATE_ID ? '' : (process.env.SEED || '')
const APPROVE_LIMIT = Number(process.env.APPROVE_LIMIT || '20')
const TIMEOUT_SEC = Number(process.env.TIMEOUT_SEC || '90')
const POLL_MS = Number(process.env.POLL_MS || '1000')

function fail(msg, code = 1) {
  console.error(`[single-seed] ${msg}`)
  process.exit(code)
}

if (!BASE) fail('SMOKE_BASE is required')
if (!TOKEN) fail('SMOKE_TOKEN is required')
if (!TEMPLATE_ID && !RAW_SEED) fail('SEED is required when TEMPLATE_ID is not provided')

function seedsParam() {
  if (TEMPLATE_ID) return ''
  const items = RAW_SEED.replace(/\n/g, ',').split(',').map(s => s.trim()).filter(Boolean)
  if (!items.length) fail('SEED contained no URLs after parsing')
  return encodeURIComponent(items.join(','))
}

async function getJson(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(TOKEN)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function main() {
  const q = TEMPLATE_ID
    ? `templateId=${encodeURIComponent(TEMPLATE_ID)}`
    : `target=${encodeURIComponent(TARGET)}&seeds=${seedsParam()}`

  console.log(`[single-seed] prepare… (${TEMPLATE_ID ? `templateId=${TEMPLATE_ID}` : `target=${TARGET}`})`)
  const started = await getJson(`/resources/smoke/importer/prepare?${q}`)
  if (!started?.ok || !started?.runId) fail(`prepare failed: ${JSON.stringify(started)}`)
  const runId = started.runId
  console.log(`[single-seed] runId=${runId} candidates=${started.candidates ?? 'n/a'} expectedItems=${started.expectedItems ?? 'n/a'}`)

  // Poll for diffs/staging counts until we see >0 diffs or timeout
  const until = Date.now() + TIMEOUT_SEC * 1000
  let reported = { staged: -1, diffs: -1 }
  while (Date.now() < until) {
    const exp = await getJson(`/resources/smoke/importer/run-expected?runId=${encodeURIComponent(runId)}`)
    const stats = await getJson(`/resources/smoke/importer/run-stats?runId=${encodeURIComponent(runId)}`)
    const staged = Number(exp?.stagedCount || 0)
    const diffs = Number(exp?.diffCount || 0)
    if (staged !== reported.staged || diffs !== reported.diffs) {
      const counts = stats?.counts ? ` counts=${JSON.stringify(stats.counts)}` : ''
      console.log(`[single-seed] staged=${staged} diffs=${diffs}${counts}`)
      reported = { staged, diffs }
    }
    if (diffs > 0) break
    await new Promise(r => setTimeout(r, POLL_MS))
  }

  // Approve some adds to allow publish
  const approveRes = await getJson(`/resources/smoke/importer/approve-adds?runId=${encodeURIComponent(runId)}&limit=${APPROVE_LIMIT}`)
  if (!approveRes?.ok) fail(`approve-adds failed: ${JSON.stringify(approveRes)}`)
  console.log(`[single-seed] approved adds: ${approveRes.approved || 0}`)

  // Publish (dry-run)
  const publish = await getJson(`/resources/smoke/importer/publish-dry-run?runId=${encodeURIComponent(runId)}`)
  if (!publish?.ok) fail(`publish-dry-run failed: ${JSON.stringify(publish)}`)

  console.log(`[single-seed] publish totals: ${JSON.stringify(publish.totals)}`)
  if (publish.productIds?.length) {
    console.log(`[single-seed] productIds sample: ${publish.productIds.slice(0, 5).join(',')}`)
  }
  console.log(`[single-seed] done. Review at /app/imports/runs/${runId}/review (HQ session required)\n`)
}

main().catch(err => fail(err?.message || String(err)))
