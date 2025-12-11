import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BatsonSyncSnapshot } from '../../app/services/suppliers/batsonSync.server'
import { enqueueBatsonSync, getBatsonSyncState } from '../../app/services/suppliers/batsonSync.server'
import { prisma } from '../../app/db.server'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const defaultDbUrl = `file:${resolve(repoRoot, 'prisma/dev.sqlite')}`

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = defaultDbUrl
  console.log(`[batson-sync] DATABASE_URL not set; defaulting to ${process.env.DATABASE_URL}`)
}

const POLL_INTERVAL_MS = Math.max(5_000, Number(process.env.BATSON_SYNC_POLL_INTERVAL_MS || '15000'))
const MAX_WAIT_MS = Math.max(
  POLL_INTERVAL_MS * 2,
  Number(process.env.BATSON_SYNC_TIMEOUT_MS || String(4 * 60 * 60 * 1000)),
)

const SLEEP = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type SummaryRecord = {
  jobId?: string | null
  suppliers?: Array<{ slug?: unknown; status?: unknown; ok?: unknown }>
}

async function waitForCompletion(jobId: string) {
  const started = Date.now()
  let lastLine = ''
  for (;;) {
    const snapshot = await getBatsonSyncState()
    const summary = (snapshot.lastSyncSummary as SummaryRecord | null) ?? null
    const summaryJobId = typeof summary?.jobId === 'string' ? summary?.jobId : null
    const sameJob = summaryJobId === jobId || snapshot.lastSyncJobId === jobId
    const line = formatStatusLine(snapshot)
    if (line !== lastLine) {
      console.log(line)
      lastLine = line
    }
    if (sameJob) {
      if (snapshot.currentRun.status === 'success' || snapshot.currentRun.status === 'failed') {
        return snapshot
      }
    }
    if (Date.now() - started > MAX_WAIT_MS) {
      throw new Error(`Timed out waiting for Batson sync job ${jobId}`)
    }
    await SLEEP(POLL_INTERVAL_MS)
  }
}

function formatStatusLine(state: BatsonSyncSnapshot) {
  const summary = (state.lastSyncSummary as SummaryRecord | null) ?? null
  const suppliers = Array.isArray(summary?.suppliers) ? (summary?.suppliers ?? []) : []
  const supplierBits = suppliers.map(item => {
    const slug = typeof item.slug === 'string' ? item.slug : 'unknown'
    const status = typeof item.status === 'string' ? item.status : 'queued'
    const okVal = typeof item.ok === 'boolean' ? (item.ok ? '✓' : '✕') : '…'
    return `${slug}:${status}(${okVal})`
  })
  const joined = supplierBits.length ? supplierBits.join(', ') : 'no-suppliers'
  return `[batson-sync] current=${state.currentRun.status} last=${state.lastSyncStatus ?? 'n/a'} | ${joined}`
}

async function main() {
  const startedBy = process.env.BATSON_SYNC_STARTED_BY || 'cli-runner'
  console.log(`[batson-sync] enqueueing full sync as ${startedBy}`)
  const { jobId } = await enqueueBatsonSync(startedBy)
  console.log(`[batson-sync] job ${jobId} enqueued`)
  const finalSnapshot = await waitForCompletion(jobId)
  console.log(`[batson-sync] job ${jobId} completed with status ${finalSnapshot.currentRun.status}`)
  console.log('[batson-sync] final summary:')
  console.log(JSON.stringify(finalSnapshot.lastSyncSummary, null, 2))
}

main()
  .catch(error => {
    console.error('[batson-sync] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
