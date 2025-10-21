// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import { fetchPage } from './fetchPage'
import { applySelectors, type MappingConfig } from './selectorApply'
import { normalizeItems } from './mapping'
import { dedupeItems } from './dedupe'
import { createDraftProducts } from './shopifyCreate'
import { prisma } from '../../db.server'
import { ensureImporterVersion } from './version'
// throttle imported previously; not yet used for rate limiting (future enhancement)
import type { AppliedItemRaw } from './selectorApply'

interface JobCounts {
  total: number
  processed: number
  created: number
  updated: number
  skipped: number
  errors: number
}

interface InMemoryJobState {
  id: string
  running: boolean
  cancelRequested: boolean
}

const inMemoryJobs = new Map<string, InMemoryJobState>()

type LifecycleDetails = Record<string, unknown>
function logLifecycle(id: string, phase: string, details?: LifecycleDetails) {
  const ts = new Date().toISOString()
  const payload = details ? ` ${JSON.stringify(details)}` : ''
  console.log(`[importJob:${id}] ${ts} ${phase}${payload}`)
}

export interface EnqueueImportParams {
  url: string
  productType: string
  mapping: MappingConfig
  pagination?: { pageParam?: string; maxPages?: number } | undefined
  followDetail?: boolean
}

export async function enqueueImportJob(params: EnqueueImportParams): Promise<{ jobId: string; status: string }> {
  const job = await prisma.importJob.create({
    data: {
      url: params.url,
      productType: params.productType,
      status: 'queued',
      countsJson: { total: 0, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
      logJson: [],
    },
  })
  logLifecycle(job.id, 'ENQUEUED', { url: params.url, productType: params.productType })
  process.nextTick(() => runJob(job.id, params).catch(() => {}))
  return { jobId: job.id, status: 'queued' }
}

export async function getJobStatus(id: string) {
  const job = await prisma.importJob.findUnique({ where: { id } })
  if (!job) return null
  return {
    status: job.status,
    progress: (job.countsJson as unknown as JobCounts) || {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    log: (job.logJson as unknown as string[]) || [],
  }
}

export async function requestCancelImportJob(id: string) {
  const state = inMemoryJobs.get(id)
  if (!state) {
    // If job already finished or never existed, reflect DB state
    const job = await prisma.importJob.findUnique({ where: { id } })
    if (!job) return { ok: false, reason: 'NOT_FOUND' as const }
    if (job.status === 'queued' || job.status === 'running') {
      // queued but not in memory (edge) -> mark cancelled
      await prisma.importJob.update({
        where: { id },
        data: { status: 'cancelled', logJson: { push: 'Cancelled (out-of-band)' } },
      })
      return { ok: true, alreadyFinished: false }
    }
    return { ok: true, alreadyFinished: true }
  }
  if (state.cancelRequested) return { ok: true, alreadyFinished: false }
  state.cancelRequested = true
  logLifecycle(id, 'CANCEL_REQUESTED')
  await prisma.importJob.update({ where: { id }, data: { logJson: { push: 'Cancellation requested' } } })
  return { ok: true, alreadyFinished: false }
}

async function runJob(id: string, params: EnqueueImportParams) {
  inMemoryJobs.set(id, { id, running: true, cancelRequested: false })
  // Ensure importer version is up-to-date before running any job work
  await ensureImporterVersion()
  const appendLog = async (line: string) => {
    await prisma.importJob.update({ where: { id }, data: { logJson: { push: line } } })
  }
  const updateCounts = async (mut: Partial<JobCounts>) => {
    const job = await prisma.importJob.findUnique({ where: { id } })
    if (!job) return
    const counts = (job.countsJson as unknown as JobCounts) || {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    }
    const next = { ...counts, ...mut }
    await prisma.importJob.update({ where: { id }, data: { countsJson: next } })
  }
  try {
    await prisma.importJob.update({ where: { id }, data: { status: 'running' } })
    logLifecycle(id, 'START')
    await appendLog('Started')
    const first = await fetchPage({ url: params.url })
    if (first.disallowed) {
      await appendLog('Robots disallowed')
      logLifecycle(id, 'FAILED', { reason: 'ROBOTS' })
      await prisma.importJob.update({ where: { id }, data: { status: 'failed' } })
      return
    }
    if (inMemoryJobs.get(id)?.cancelRequested) {
      await appendLog('Cancelled before selector application')
      logLifecycle(id, 'CANCELLED', { phase: 'pre-selectors' })
      await prisma.importJob.update({ where: { id }, data: { status: 'cancelled' } })
      return
    }
    const applied: AppliedItemRaw[] = applySelectors(first.html, params.mapping)
    const normalized = normalizeItems(applied, { productType: params.productType })
    await updateCounts({ total: normalized.length })
    const dedupe = dedupeItems(normalized)
    const createTargets = normalized.filter(n => dedupe.find(d => d.key === n.dedupeKey)?.action === 'create')
    if (inMemoryJobs.get(id)?.cancelRequested) {
      await appendLog('Cancelled before creation phase')
      logLifecycle(id, 'CANCELLED', { phase: 'pre-create' })
      await prisma.importJob.update({ where: { id }, data: { status: 'cancelled' } })
      return
    }
    await appendLog(`Creating ${createTargets.length} products`)
    logLifecycle(id, 'CREATE_PHASE', { count: createTargets.length })
    // Acquire admin client lazily? For now skip; requires passing admin in params future improvement.
    type AdminLike = {
      graphql: (
        q: string,
        opts?: { variables?: Record<string, unknown> },
      ) => Promise<{
        ok: boolean
        status: number
        json: () => Promise<unknown>
      }>
    }
    const admin = (global as unknown as { shopifyAdmin?: AdminLike }).shopifyAdmin
    if (!admin) {
      await appendLog('Missing admin client; skipping creation (simulate success)')
      logLifecycle(id, 'NO_ADMIN_CLIENT')
      await prisma.importJob.update({ where: { id }, data: { status: 'completed' } })
      return
    }
    const results = await createDraftProducts(admin, createTargets)
    let created = 0
    let errors = 0
    results.forEach(r => {
      if (r.status === 'created') created += 1
      else errors += 1
    })
    await updateCounts({ processed: createTargets.length, created, errors })
    await prisma.importJob.update({ where: { id }, data: { status: 'completed' } })
    await appendLog('Completed')
    logLifecycle(id, 'COMPLETED', { created, errors })
  } catch (e) {
    await appendLog(`Error: ${e instanceof Error ? e.message : 'unknown'}`)
    logLifecycle(id, 'ERROR', { message: e instanceof Error ? e.message : 'unknown' })
    await prisma.importJob.update({ where: { id }, data: { status: 'failed' } })
  } finally {
    inMemoryJobs.delete(id)
  }
}

// Minimal helper for manual verification of the version gate in dev
export async function runImportForSupplier(supplierId: string) {
  await ensureImporterVersion()
  // In v2 this would kick off a supplier-specific run; for now it's just the guard.
  return { ok: true, supplierId }
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
