// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export enum ImportState {
  NEEDS_SETTINGS = 'NEEDS_SETTINGS',
  READY_TO_TEST = 'READY_TO_TEST',
  IN_TEST = 'IN_TEST',
  READY_TO_APPROVE = 'READY_TO_APPROVE',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  ABORTED = 'ABORTED',
  FAILED = 'FAILED',
}

export interface ImportCounts {
  added: number
  updated: number
  failed: number
  skipped: number
}

export interface ImportRun {
  id: string
  templateId: string
  state: ImportState
  lastRunAt?: string
  nextRunAt?: string
  counts?: ImportCounts
}

type TemplateId = string

// Minimal in-memory store to simulate persistence and Shopify product ops in Logic Pass 1
type StoredConfig = {
  templateId: TemplateId
  state: ImportState
  runId?: string
  productUrls?: string[]
  counts?: ImportCounts
  schedule?: ScheduleConfig
  hadFailures?: boolean
}

const _configs = new Map<TemplateId, StoredConfig>()
const _runDrafts = new Map<string, string[]>() // key: rbp-import:<runId> -> productIds
const _published = new Set<string>() // productIds that are published
const _logs: Array<{
  at: string
  templateId: string
  runId: string
  type: 'discovery' | 'scrape' | 'drafts' | 'approve' | 'abort' | 'schedule' | 'recrawl' | 'error'
  payload: unknown
}> = []

/** Adapter interfaces (Logic Pass 1: stubbed IO behind adapters) */
export type ScheduleConfig = {
  enabled: boolean
  freq: 'daily' | 'weekly' | 'monthly' | 'none'
  at?: string
  nextRunAt?: string
}
import { repo, discover, scrape, shopify, schedule as scheduleRepo, flags } from '../server/importer.adapters'

// helper: compute next run time based on now, freq and HH:mm "at"
const computeNextRun = (nowIso: string, cfg: ScheduleConfig): string | undefined => {
  if (!cfg.enabled) return undefined
  if (!cfg.freq || cfg.freq === 'none') return undefined
  const now = new Date(nowIso)
  if (Number.isNaN(now.getTime())) return undefined
  const [hh, mm] = (cfg.at || '09:00').split(':').map(v => parseInt(v, 10))
  const next = new Date(now)
  next.setSeconds(0, 0)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    next.setHours(9, 0, 0, 0)
  } else {
    next.setHours(hh, mm, 0, 0)
  }
  const ensureFuture = (d: Date) => {
    if (d.getTime() <= now.getTime()) {
      if (cfg.freq === 'daily') d.setDate(d.getDate() + 1)
      else if (cfg.freq === 'weekly') d.setDate(d.getDate() + 7)
      else if (cfg.freq === 'monthly') d.setMonth(d.getMonth() + 1)
    }
  }
  ensureFuture(next)
  return next.toISOString()
}

const newRunId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const importerAdapters = {
  getImportConfig: (templateId: string) => repo.getImportConfig(templateId) as Promise<StoredConfig>,
  saveImportConfig: (templateId: string, patch: any) => repo.saveImportConfig(templateId, patch),

  getSchedule: (templateId: string) => scheduleRepo.get(templateId),
  saveSchedule: (templateId: string, cfg: ScheduleConfig) => scheduleRepo.save(templateId, cfg),

  computeNextRun,

  discoverProductUrls: (templateId: string) => discover.urls(templateId),
  scrapeProducts: (templateId: string, urls: string[]) => scrape.products(templateId, urls),

  createDraftProducts: (templateId: string, runId: string, items: any[]) =>
    shopify.createDrafts(templateId, runId, items),
  publishByRunTag: (templateId: string, runId: string) => shopify.publishByRunTag(templateId, runId),
  deleteDraftsByRunTag: (templateId: string, runId: string) => shopify.deleteDraftsByRunTag(templateId, runId),

  updateExistingProducts: (templateId: string, items: any[]) => shopify.updateExisting(templateId, items),

  logEvent: (templateId: string, runId: string, type: any, payload: unknown) =>
    repo.appendLog(templateId, runId, type, payload),

  getFlags: (templateId: string) => flags.get(templateId),

  newRunId,
}

export const importerActions = {
  /** Called after Settings save & validation success */
  markReadyToTest: async (templateId: TemplateId) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    await importerAdapters.saveImportConfig(templateId, { ...cfg, state: ImportState.READY_TO_TEST })
  },

  /** TEST: discovery + scrape + create DRAFTS (tag=rbp-import:<runId>) */
  testRun: async (templateId: TemplateId) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    // If there is a previous unapproved run, clean up drafts
    if (
      cfg.runId &&
      (cfg.state === ImportState.READY_TO_APPROVE ||
        cfg.state === ImportState.IN_TEST ||
        cfg.state === ImportState.FAILED)
    ) {
      try {
        await importerAdapters.deleteDraftsByRunTag(templateId, cfg.runId)
      } catch {
        /* ignore */
      }
    }

    const runId = importerAdapters.newRunId()
    await importerAdapters.saveImportConfig(templateId, { ...cfg, runId, state: ImportState.IN_TEST })

    // 3) discover
    const urls = await importerAdapters
      .discoverProductUrls(templateId)
      .then(u => (Array.isArray(u) && u.length ? u : []))
    await importerAdapters.logEvent(templateId, runId, 'discovery', { urls })

    // 4) scrape
    const { successes, failures } = await importerAdapters.scrapeProducts(templateId, urls)
    await importerAdapters.logEvent(templateId, runId, 'scrape', { successes: successes.length, failures })

    // 5) drafts
    const drafts = await importerAdapters.createDraftProducts(
      templateId,
      runId,
      successes.map(s => s.data),
    )
    await importerAdapters.logEvent(templateId, runId, 'drafts', { productIds: drafts.productIds })

    // 6) counts + state
    const counts: ImportCounts = {
      added: drafts.productIds.length,
      updated: 0,
      failed: failures.length,
      skipped: Math.max(0, urls.length - successes.length - failures.length),
    }
    await importerAdapters.saveImportConfig(templateId, {
      ...cfg,
      runId,
      counts,
      lastRunAt: new Date().toISOString(),
      state: ImportState.READY_TO_APPROVE,
    } as Partial<StoredConfig> as StoredConfig)
  },

  /** APPROVE: publish all drafts for current runId */
  approveRun: async (templateId: TemplateId) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    if (!cfg.runId) return
    const res = await importerAdapters.publishByRunTag(templateId, cfg.runId)
    await importerAdapters.logEvent(templateId, cfg.runId, 'approve', res)
    await importerAdapters.saveImportConfig(templateId, { ...cfg, state: ImportState.APPROVED })
  },

  /** DELETE/RESET: delete drafts for current runId & clear counters */
  deleteResetRun: async (templateId: TemplateId) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    if (cfg.runId) {
      const res = await importerAdapters.deleteDraftsByRunTag(templateId, cfg.runId)
      await importerAdapters.logEvent(templateId, cfg.runId, 'abort', res)
    }
    await importerAdapters.saveImportConfig(templateId, {
      ...cfg,
      counts: undefined,
      runId: undefined,
      state: ImportState.READY_TO_TEST,
    })
  },

  /** Suspend schedule when config changes (called by Settings save path) */
  suspendScheduleOnConfigChange: async (templateId: TemplateId) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    const wasScheduled = !!cfg.schedule?.enabled
    const next: StoredConfig = {
      ...cfg,
      schedule: {
        enabled: false,
        freq: (cfg.schedule?.freq ?? 'none') as ScheduleConfig['freq'],
        at: cfg.schedule?.at,
        nextRunAt: undefined,
      },
      state: wasScheduled || cfg.state === ImportState.APPROVED ? ImportState.NEEDS_SETTINGS : cfg.state,
    }
    await importerAdapters.saveImportConfig(templateId, next)
  },

  // Schedule enable/disable toggle with state transitions and logging
  setScheduleEnabled: async (templateId: string, enabled: boolean) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    const sched = await importerAdapters.getSchedule(templateId)
    const nowIso = new Date().toISOString()
    const next: ScheduleConfig = { ...sched, enabled }
    if (enabled) {
      // Only allow scheduling when APPROVED or SCHEDULED
      if (cfg.state === ImportState.APPROVED || cfg.state === ImportState.SCHEDULED) {
        next.nextRunAt = importerAdapters.computeNextRun(nowIso, { ...next })
        await importerAdapters.saveSchedule(templateId, next)
        await importerAdapters.saveImportConfig(templateId, { ...cfg, schedule: next, state: ImportState.SCHEDULED })
      } else {
        // Keep disabled if not eligible
        next.enabled = false
        next.nextRunAt = undefined
        await importerAdapters.saveSchedule(templateId, next)
      }
    } else {
      // disabling -> revert to APPROVED
      next.nextRunAt = undefined
      await importerAdapters.saveSchedule(templateId, next)
      await importerAdapters.saveImportConfig(templateId, { ...cfg, schedule: next, state: ImportState.APPROVED })
    }
    const runId = cfg.runId || importerAdapters.newRunId()
    await importerAdapters.logEvent(templateId, runId, 'schedule', {
      enabled: next.enabled,
      freq: next.freq,
      at: next.at,
      nextRunAt: next.nextRunAt,
    })
  },

  // Update schedule fields, recompute nextRunAt if enabled, and log
  updateSchedule: async (templateId: string, patch: Partial<ScheduleConfig>) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    const cur = await importerAdapters.getSchedule(templateId)
    const merged: ScheduleConfig = {
      enabled: !!cur.enabled,
      freq: cur.freq ?? 'none',
      at: cur.at,
      nextRunAt: cur.nextRunAt,
      ...patch,
    }
    if (merged.enabled) {
      merged.nextRunAt = importerAdapters.computeNextRun(new Date().toISOString(), merged) || merged.nextRunAt
    }
    await importerAdapters.saveSchedule(templateId, merged)
    await importerAdapters.saveImportConfig(templateId, { ...cfg, schedule: merged })
    const runId = cfg.runId || importerAdapters.newRunId()
    await importerAdapters.logEvent(templateId, runId, 'schedule', {
      enabled: merged.enabled,
      freq: merged.freq,
      at: merged.at,
      nextRunAt: merged.nextRunAt,
    })
  },

  // Recrawl now: update in-place by default, or create drafts if flagged
  recrawlRunNow: async (templateId: string) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    if (cfg.state !== ImportState.APPROVED && cfg.state !== ImportState.SCHEDULED) return
    const runId = importerAdapters.newRunId()
    try {
      const urls = await importerAdapters.discoverProductUrls(templateId)
      const scrape = await importerAdapters.scrapeProducts(templateId, urls)
      const flags = await importerAdapters.getFlags(templateId)
      let result: { updatedIds?: string[]; skippedIds?: string[]; failed?: unknown[]; draftIds?: string[] }
      if (flags.createDraftsOnRecrawl) {
        const drafts = await importerAdapters.createDraftProducts(
          templateId,
          runId,
          (scrape.successes as Array<{ data: unknown }>).map(s => s.data),
        )
        result = { updatedIds: [], skippedIds: [], failed: scrape.failures, draftIds: drafts.productIds }
        await importerAdapters.logEvent(templateId, runId, 'drafts', { count: drafts.productIds.length })
      } else {
        result = await importerAdapters.updateExistingProducts(
          templateId,
          (scrape.successes as Array<{ data: unknown }>).map(s => s.data),
        )
      }
      await importerAdapters.logEvent(templateId, runId, 'recrawl', result)
      const hadFailures = (result.failed?.length || 0) > 0
      await importerAdapters.saveImportConfig(templateId, {
        ...cfg,
        counts: {
          added: 0,
          updated: result.updatedIds?.length || 0,
          failed: result.failed?.length || 0,
          skipped: result.skippedIds?.length || 0,
        },
        lastRunAt: new Date().toISOString(),
        state: hadFailures ? ImportState.SCHEDULED : cfg.state,
        hadFailures,
      } as Partial<StoredConfig> as StoredConfig)
    } catch (err) {
      await importerAdapters.logEvent(templateId, runId, 'error', { message: (err as Error)?.message || String(err) })
      await importerAdapters.saveImportConfig(templateId, { ...cfg, state: ImportState.FAILED, hadFailures: true })
    }
  },
}
// <!-- END RBP GENERATED: importer-v2-3 -->
