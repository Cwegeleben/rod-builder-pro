// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type { ScheduleConfig } from '../state/importerMachine'
import { importerRepo } from './importer.repo'
// TODO: bridge Shopify Admin here when wiring real operations

export const repo = {
  getImportConfig: async (templateId: string) => {
    const tpl = await importerRepo.get(templateId)
    if (!tpl) return { templateId, state: 'NEEDS_SETTINGS', importConfig: {} }
    const cfg = typeof tpl.importConfig === 'object' ? (tpl.importConfig as Record<string, unknown>) : {}
    return {
      templateId: tpl.id,
      state: tpl.state as string,
      lastRunAt: tpl.lastRunAt?.toISOString(),
      hadFailures: !!tpl.hadFailures,
      ...cfg,
    }
  },
  saveImportConfig: async (templateId: string, patch: any) => {
    const cur = await importerRepo.get(templateId)
    const curCfg = (cur?.importConfig as Record<string, unknown>) ?? {}
    const nextCfg = { ...curCfg, ...(patch.importConfig || {}), ...patch }
    await importerRepo.upsert(templateId, {
      importConfig: nextCfg,
      ...(patch.state ? { state: patch.state } : {}),
      ...(patch.lastRunAt ? { lastRunAt: patch.lastRunAt } : {}),
      ...(patch.hadFailures != null ? { hadFailures: patch.hadFailures } : {}),
    })
  },
  appendLog: async (templateId: string, runId: string, type: string, payload: unknown) => {
    await importerRepo.appendLog(templateId, runId, type, payload)
  },
}

export const discover = {
  urls: async (templateId: string): Promise<string[]> => {
    const cfg = await repo.getImportConfig(templateId)
    const urls = (cfg as any).productUrls
    return Array.isArray(urls) ? urls : []
  },
}

export const scrape = {
  products: async (_templateId: string, urls: string[]) => {
    return {
      successes: urls.map(u => ({ data: { sourceUrl: u }, sourceUrl: u })),
      failures: [] as Array<{ sourceUrl: string; error: string }>,
    }
  },
}

export const shopify = {
  createDrafts: async (_templateId: string, _runId: string, items: any[]) => {
    return { productIds: items.map((_, i) => `draft_${i + 1}`) }
  },
  publishByRunTag: async (_templateId: string, _runId: string) => {
    return { publishedIds: [], alreadyActiveIds: [], missingIds: [] }
  },
  deleteDraftsByRunTag: async (_templateId: string, _runId: string) => {
    return { deletedIds: [], missingIds: [] }
  },
  updateExisting: async (_templateId: string, items: any[]) => {
    return {
      updatedIds: items.map((_, i) => `upd_${i + 1}`),
      skippedIds: [],
      failed: [] as Array<{ sourceUrl?: string; error: string }>,
    }
  },
}

export const schedule = {
  get: async (templateId: string): Promise<ScheduleConfig> => {
    const cfg = await repo.getImportConfig(templateId)
    const schedule: ScheduleConfig = (cfg as any).schedule ?? { enabled: false, freq: 'none' }
    return schedule
  },
  save: async (templateId: string, cfg: ScheduleConfig) => {
    await repo.saveImportConfig(templateId, { importConfig: { schedule: cfg } })
  },
}

export const flags = {
  get: async (_templateId: string) => ({ createDraftsOnRecrawl: false }),
}
// <!-- END RBP GENERATED: importer-v2-3 -->
