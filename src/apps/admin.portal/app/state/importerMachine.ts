// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
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
}

const _configs = new Map<TemplateId, StoredConfig>()
const _runDrafts = new Map<string, string[]>() // key: rbp-import:<runId> -> productIds
const _published = new Set<string>() // productIds that are published
const _logs: Array<{
  at: string
  templateId: string
  runId: string
  type: 'discovery' | 'scrape' | 'drafts' | 'approve' | 'abort' | 'schedule' | 'error'
  payload: unknown
}> = []

/** Adapter interfaces (Logic Pass 1: stubbed IO behind adapters) */
export type ScheduleConfig = {
  enabled: boolean
  freq: 'daily' | 'weekly' | 'monthly' | 'none'
  at?: string
  nextRunAt?: string
}

export const importerAdapters = {
  // Reads & writes ImportConfig + state safely (atomic)
  getImportConfig: async (templateId: TemplateId): Promise<StoredConfig> => {
    if (!_configs.has(templateId))
      _configs.set(templateId, { templateId, state: ImportState.NEEDS_SETTINGS, productUrls: [] })
    // Return a shallow clone to avoid external mutation
    const cfg = _configs.get(templateId) as StoredConfig
    return {
      ...cfg,
      counts: cfg.counts ? { ...cfg.counts } : undefined,
      schedule: cfg.schedule ? { ...cfg.schedule } : undefined,
    }
  },
  saveImportConfig: async (templateId: TemplateId, patch: Partial<StoredConfig>): Promise<void> => {
    const cur = await importerAdapters.getImportConfig(templateId)
    const next = { ...cur, ...patch }
    _configs.set(templateId, next)
  },
  getSchedule: async (templateId: TemplateId): Promise<ScheduleConfig> => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    const existing: ScheduleConfig | undefined = cfg.schedule
    const schedule: ScheduleConfig = existing ? { ...existing } : { enabled: false, freq: 'none' }
    return schedule
  },
  saveSchedule: async (templateId: TemplateId, schedule: ScheduleConfig) => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    await importerAdapters.saveImportConfig(templateId, { ...cfg, schedule })
  },

  // helper: compute next run time based on now, freq and HH:mm "at"
  computeNextRun: (nowIso: string, cfg: ScheduleConfig): string | undefined => {
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
    // If time already passed today, move to next period start
    const ensureFuture = (d: Date) => {
      if (d.getTime() <= now.getTime()) {
        if (cfg.freq === 'daily') d.setDate(d.getDate() + 1)
        else if (cfg.freq === 'weekly') d.setDate(d.getDate() + 7)
        else if (cfg.freq === 'monthly') d.setMonth(d.getMonth() + 1)
      }
    }
    ensureFuture(next)
    // For weekly/monthly, if still today but in past, above handles it; otherwise this is fine
    return next.toISOString()
  },

  // Scraper & discovery (returns normalized items; failed list too)
  discoverProductUrls: async (templateId: TemplateId): Promise<string[]> => {
    const cfg = await importerAdapters.getImportConfig(templateId)
    return Array.isArray(cfg.productUrls) && cfg.productUrls.length ? cfg.productUrls : []
  },
  scrapeProducts: async (_templateId: TemplateId, urls: string[]) => {
    // Simulate scrape: all URLs succeed except ones containing "fail"
    const successes: Array<{ data: { title: string; url: string }; sourceUrl: string }> = []
    const failures: Array<{ sourceUrl: string; error: string }> = []
    for (const u of urls) {
      if (/fail/i.test(u)) failures.push({ sourceUrl: u, error: 'Simulated scrape failure' })
      else successes.push({ data: { title: `Draft for ${u}`, url: u }, sourceUrl: u })
    }
    return { successes, failures }
  },

  // Shopify ops — draft create / publish / delete by tag
  createDraftProducts: async (_templateId: TemplateId, runId: string, items: unknown[]) => {
    const tag = `rbp-import:${runId}`
    const ids = items.map((_, idx) => `gid://shopify/Product/${Date.now()}${idx}`)
    _runDrafts.set(tag, ids)
    // mark as not published yet
    for (const id of ids) _published.delete(id)
    return { productIds: ids }
  },
  publishByRunTag: async (_templateId: TemplateId, runId: string) => {
    const tag = `rbp-import:${runId}`
    const ids = _runDrafts.get(tag) || []
    const publishedIds: string[] = []
    const alreadyActiveIds: string[] = []
    const missingIds: string[] = []
    for (const id of ids) {
      if (!id) {
        missingIds.push(id)
        continue
      }
      if (_published.has(id)) alreadyActiveIds.push(id)
      else {
        _published.add(id)
        publishedIds.push(id)
      }
    }
    return { publishedIds, alreadyActiveIds, missingIds }
  },
  deleteDraftsByRunTag: async (_templateId: TemplateId, runId: string) => {
    const tag = `rbp-import:${runId}`
    const ids = _runDrafts.get(tag) || []
    const deletedIds: string[] = []
    const missingIds: string[] = []
    for (const id of ids) {
      if (id) deletedIds.push(id)
      else missingIds.push(id)
    }
    _runDrafts.delete(tag)
    return { deletedIds, missingIds }
  },

  // Logs (global + template-scoped)
  logEvent: async (
    templateId: TemplateId,
    runId: string,
    type: 'discovery' | 'scrape' | 'drafts' | 'approve' | 'abort' | 'schedule' | 'error',
    payload: unknown,
  ) => {
    _logs.push({ at: new Date().toISOString(), templateId, runId, type, payload })
  },

  // Run ID
  newRunId: (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
}
// <!-- END RBP GENERATED: importer-v2-3 -->
