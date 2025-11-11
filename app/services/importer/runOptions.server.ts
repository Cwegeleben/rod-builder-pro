// hq-run-options-scrape-preview-v1
import { prisma } from '../../db.server'
// Canonical product_db writer (phase 1); gated by PRODUCT_DB_ENABLED
import { upsertNormalizedProduct } from '../productDbWriter.server'
import type { Prisma } from '@prisma/client'
import { markSkipSuccessfulForRun } from '../../../packages/importer/src/pipelines/diffWithSkip'
// <!-- BEGIN RBP GENERATED: scrape-template-wiring-v2 -->
import { crawlBatson } from '../../../packages/importer/src/crawlers/batsonCrawler'
import type { BatsonGridRowRaw, BlankSpec } from '../../server/importer/products/batsonAttributeGrid'
import { fetchActiveSources, upsertProductSource } from '../../../packages/importer/src/seeds/sources'

export type RunOptions = {
  mode: 'discover' | 'price_avail'
  includeSeeds: boolean
  manualUrls: string[]
  skipSuccessful: boolean
  notes?: string
  // Supplier identifier (matches ImportTarget.siteId); used for staging/seeds/diffs
  supplierId?: string
  // Template partition for isolation (optional; null/undefined implies legacy global supplier scope)
  templateId?: string
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  templateKey?: string
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
  // hq-importer-new-import-v2
  variantTemplateId?: string
  scraperId?: string
  // Parser-driven staging switch (series page parser instead of full crawler)
  useSeriesParser?: boolean
}

type ImportRunSummary = { counts?: Record<string, number>; options?: RunOptions }

const DEFAULT_OPTIONS: RunOptions = {
  mode: 'discover',
  includeSeeds: true,
  manualUrls: [],
  skipSuccessful: false,
  notes: '',
  useSeriesParser: false,
}

// Centralized where builder for clarity
const partStagingWhere = (supplierId: string, templateId?: string | null) =>
  templateId != null ? { supplierId, templateId } : { supplierId }

export function parseRunOptions(formData: FormData): RunOptions {
  const includeSeeds = formData.get('includeSeeds') === 'on'
  const skipSuccessful = formData.get('skipSuccessful') === 'on'
  const notes = String(formData.get('notes') || '')
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  const templateKey = String(formData.get('templateKey') || '').trim() || undefined
  const templateId = String(formData.get('templateId') || '').trim() || undefined
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
  // hq-importer-new-import-v2
  const variantTemplateId = String(formData.get('variantTemplateId') || '').trim() || undefined
  const scraperId = String(formData.get('scraperId') || '').trim() || undefined
  const useSeriesParser = formData.get('useSeriesParser') === 'on'
  const manualStr = String(formData.get('manualUrls') || '')
  const manualUrls = manualStr
    .split(/\r?\n|,/) // allow CSV or newline list
    .map(s => s.trim())
    .filter(Boolean)
  return {
    ...DEFAULT_OPTIONS,
    includeSeeds,
    manualUrls,
    skipSuccessful,
    notes,
    templateKey,
    templateId,
    variantTemplateId,
    scraperId,
    useSeriesParser,
  }
}

export async function loadRunOptions(runId: string | null | undefined): Promise<RunOptions> {
  if (!runId) return DEFAULT_OPTIONS
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  const opts = (run?.summary as unknown as ImportRunSummary | undefined)?.options
  return { ...DEFAULT_OPTIONS, ...(opts || {}) }
}

export async function writeOptionsToRun(runId: string, options: RunOptions) {
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  const prevSummary = (run?.summary as unknown as ImportRunSummary | undefined) || {}
  await prisma.importRun.update({
    where: { id: runId },
    data: { summary: { ...(prevSummary || {}), options } as unknown as object },
  })
}

/**
 * Crawl sources based on options and compute diffs. If runId is provided, attach diffs to that run; otherwise create a new run.
 */
type AdminClient = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> }

export async function startImportFromOptions(
  options: RunOptions,
  runId?: string,
  admin?: AdminClient,
): Promise<string> {
  // Lightweight progress updater that tolerates missing column before migration
  async function setProgress(
    id: string,
    data: { status?: string; phase?: string; percent?: number; etaSeconds?: number; details?: Record<string, unknown> },
  ) {
    try {
      const patch: Record<string, unknown> = {}
      if (data.status) patch.status = data.status
      const progress: Record<string, unknown> = {}
      if (data.phase) progress.phase = data.phase
      if (typeof data.percent === 'number') progress.percent = data.percent
      if (typeof data.etaSeconds === 'number') progress.etaSeconds = data.etaSeconds
      if (data.details) progress.details = data.details
      if (Object.keys(progress).length) patch.progress = progress as unknown as object
      await prisma.importRun.update({ where: { id }, data: patch })
    } catch {
      // ignore pre-migration or transient errors
    }
  }
  async function isCancelRequested(id: string): Promise<boolean> {
    try {
      const run = await prisma.importRun.findUnique({ where: { id } })
      const summary = (run?.summary as unknown as { control?: { cancelRequested?: boolean } }) || {}
      return !!summary.control?.cancelRequested
    } catch {
      return false
    }
  }
  async function throwIfCancelled(id?: string) {
    if (!id) return
    if (await isCancelRequested(id)) {
      try {
        await prisma.importRun.update({ where: { id }, data: { status: 'cancelled', finishedAt: new Date() } })
      } catch {
        /* ignore */
      }
      throw new Error('cancelled')
    }
  }
  // <!-- BEGIN RBP GENERATED: importer-prepare-review-wirefix-v1 -->
  // Force Prepare Review launcher to discovery mode (never short-circuit as price_avail)
  if (options.mode !== 'discover') options.mode = 'discover'
  const supplierId = options.supplierId || 'batson'
  const templateId = options.templateId || null
  // Helper to stage from series parser (Batson attribute grid)
  async function stageFromSeriesParser(seedUrls: string[]) {
    const { renderHeadlessHtml } = await import('../../server/headless/renderHeadlessHtml')
    const { PRODUCT_MODELS } = await import('../../server/importer/products/models')
    const { upsertStaging } = await import('../../../packages/importer/src/staging/upsert')
    const { upsertProductSource } = await import('../../../packages/importer/src/seeds/sources')
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    }
    async function fetchStatic(url: string): Promise<string | null> {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20_000)
      try {
        const r = await fetch(url, { headers, signal: ctrl.signal })
        if (!r.ok) return null
        return await r.text()
      } catch {
        return null
      } finally {
        clearTimeout(timer)
      }
    }
    const parse = PRODUCT_MODELS['batson-attribute-grid']
    for (const src of seedUrls) {
      let html: string | null = await fetchStatic(src)
      if (!html) {
        try {
          html = await renderHeadlessHtml(src, { timeoutMs: 20_000 })
        } catch {
          html = null
        }
      }
      if (!html) continue
      const base = (() => {
        try {
          const u = new URL(src)
          return `${u.protocol}//${u.hostname}`
        } catch {
          return 'https://batsonenterprises.com'
        }
      })()
      const parsed = parse(html, base)
      const rows = (parsed.rows as Array<{ raw: BatsonGridRowRaw; spec: BlankSpec }>) || []
      for (const r of rows) {
        const externalId = String(r.raw.code || r.raw.model || '')
        if (!externalId) continue
        // Compute normalized title at Save & Crawl time
        let title = String(r.raw.model || r.raw.code || '')
        try {
          const { buildBatsonTitle } = await import('../../server/importer/products/titleNormalize')
          const proposed = buildBatsonTitle({
            code: r.raw.code,
            model: r.raw.model,
            series: r.spec.series,
            length_label: r.spec.length_label,
            length_in: r.spec.length_in,
            material: r.spec.material,
            power: r.spec.power,
            pieces: r.spec.pieces,
            color: r.spec.color,
          })
          if (proposed && proposed.trim()) title = proposed
        } catch {
          // fall back silently if normalization module unavailable
        }
        const partType = 'Rod Blank'
        const description = ''
        const images: string[] = Array.from(
          new Set([...((r.spec as unknown as { images?: string[] })?.images || [])]),
        ).filter(Boolean) as string[]
        const rawSpecs = { raw: r.raw, spec: r.spec }
        const normSpecs = { ...r.spec, availability: r.raw.availability }
        // Sanitize price fields: accept only numeric; strip currency and fallback to null
        const toNumberOrNull = (v: unknown): number | null => {
          if (v === null || v === undefined) return null
          if (typeof v === 'number') return isNaN(v) ? null : v
          if (typeof v === 'string') {
            const cleaned = v.replace(/[^\d.-]/g, '')
            if (!cleaned) return null
            const n = Number(cleaned)
            return isNaN(n) ? null : n
          }
          return null
        }
        const priceWh = toNumberOrNull((r.raw as { price?: unknown }).price)
        const priceMsrp = toNumberOrNull((r.raw as { msrp?: unknown }).msrp)
        const availability = r.raw.availability ?? null
        await upsertStaging(supplierId, {
          templateId: templateId || undefined,
          externalId,
          title,
          partType,
          description,
          images,
          rawSpecs,
          normSpecs,
          priceWh,
          priceMsrp,
          availability,
        })
        // Proactively seed a search URL to reach detail pages for image extraction
        try {
          const searchUrl = `${base}/ecom/purchaselistsearch?keywords=${encodeURIComponent(externalId)}`
          await upsertProductSource(supplierId, searchUrl, 'discovered', 'seeded-from-series', templateId || undefined)
        } catch {
          /* ignore */
        }
      }
    }
  }
  // Record manual URLs as sources
  for (const url of options.manualUrls) {
    await upsertProductSource(supplierId, url, 'manual', options.notes, templateId || undefined)
  }
  // Compose seeds
  // When using the series parser, restrict crawl seeds to only the manual URLs for this run
  const saved =
    options.includeSeeds && !options.useSeriesParser
      ? (await fetchActiveSources(supplierId, templateId || undefined)).map((s: { url: string }) => s.url)
      : []
  // Sanitize and de-duplicate seeds; only allow absolute http(s) URLs to avoid SyntaxError from URL/fetch
  const isValidHttpUrl = (s: string): boolean => {
    try {
      const u = new URL(s)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }
  const seeds = Array.from(new Set([...saved, ...options.manualUrls])).filter(isValidHttpUrl)
  if (runId)
    await setProgress(runId, { status: 'discover', phase: 'discover', percent: 15, details: { seeds: seeds.length } })
  await throwIfCancelled(runId)
  // Stage products: for Batson, run the reliable series parser first, then follow with the crawler to backfill any misses
  if (options.useSeriesParser) {
    if (runId)
      await setProgress(runId, { status: 'crawling', phase: 'crawl', percent: 30, details: { seeds: seeds.length } })
    await throwIfCancelled(runId)
    await stageFromSeriesParser(seeds)
    const crawlRes = await crawlBatson(seeds, {
      templateKey: options.templateKey,
      templateId: templateId || undefined,
      politeness: { jitterMs: [300, 800], maxConcurrency: 1, rpm: 30, blockAssetsOnLists: true },
      supplierId,
      // Do not include previously saved seeds for series-targeted runs to avoid cross-series noise
      ignoreSavedSources: true,
    })
    try {
      if (runId && crawlRes) {
        const run = await prisma.importRun.findUnique({ where: { id: runId } })
        const prevSummary = (run?.summary as unknown as ImportRunSummary | undefined) || {}
        const counts = { ...(prevSummary.counts || {}), headerSkip: crawlRes.headerSkipCount }
        await prisma.importRun.update({
          where: { id: runId },
          data: { summary: { ...(prevSummary || {}), counts } as unknown as object },
        })
        await prisma.importLog.create({
          data: {
            templateId: options.notes?.replace(/^prepare:/, '') || 'n/a',
            runId,
            type: 'crawl:headers',
            payload: { headerSkipCount: crawlRes.headerSkipCount, headerSkips: crawlRes.headerSkips.slice(0, 50) },
          },
        })
      }
    } catch {
      /* ignore header skip logging errors */
    }
  } else {
    if (runId)
      await setProgress(runId, { status: 'crawling', phase: 'crawl', percent: 30, details: { seeds: seeds.length } })
    await throwIfCancelled(runId)
    const crawlRes = await crawlBatson(seeds, {
      templateKey: options.templateKey,
      templateId: templateId || undefined,
      // Conservative defaults for Fly Machines with headless Chromium
      politeness: { jitterMs: [300, 800], maxConcurrency: 1, rpm: 30, blockAssetsOnLists: true },
      supplierId,
    })
    try {
      if (runId && crawlRes) {
        const run = await prisma.importRun.findUnique({ where: { id: runId } })
        const prevSummary = (run?.summary as unknown as ImportRunSummary | undefined) || {}
        const counts = { ...(prevSummary.counts || {}), headerSkip: crawlRes.headerSkipCount }
        await prisma.importRun.update({
          where: { id: runId },
          data: { summary: { ...(prevSummary || {}), counts } as unknown as object },
        })
        await prisma.importLog.create({
          data: {
            templateId: options.notes?.replace(/^prepare:/, '') || 'n/a',
            runId,
            type: 'crawl:headers',
            payload: { headerSkipCount: crawlRes.headerSkipCount, headerSkips: crawlRes.headerSkips.slice(0, 50) },
          },
        })
      }
    } catch {
      /* ignore header skip logging errors */
    }
  }
  if (runId) await setProgress(runId, { status: 'staging', phase: 'stage', percent: 60 })
  await throwIfCancelled(runId)
  // Generate diffs
  // BEGIN product_db wiring (phase 1): write canonical Product + ProductVersion rows from current staging scope
  if (process.env.PRODUCT_DB_ENABLED === '1') {
    try {
      const stagingRows = await prisma.partStaging.findMany({ where: partStagingWhere(supplierId, templateId) })
      for (const r of stagingRows) {
        try {
          await upsertNormalizedProduct({
            supplier: { id: supplierId },
            sku: r.externalId,
            title: r.title,
            type: r.partType || null,
            description: (r.description as string | null) || null,
            images: (r.images as unknown as Prisma.InputJsonValue) || null,
            rawSpecs: (r.rawSpecs as unknown as Prisma.InputJsonValue) || null,
            normSpecs: (r.normSpecs as unknown as Prisma.InputJsonValue) || null,
            priceMsrp: r.priceMsrp != null ? Number(r.priceMsrp as unknown as number | string) : null,
            priceWholesale: r.priceWh != null ? Number(r.priceWh as unknown as number | string) : null,
            availability: (r as { availability?: string }).availability || null,
            sources: null,
            fetchedAt: r.fetchedAt || new Date(),
          })
        } catch (e) {
          // Non-fatal; log first 3 failures in console for diagnostics
          const msg = (e as Error)?.message || String(e)
          if (Math.random() < 0.02) console.warn('[product_db_writer] upsert failed (sampled)', msg)
        }
      }
    } catch (e) {
      console.warn('[product_db_writer] bulk upsert staging -> product_db failed (non-fatal)', (e as Error)?.message)
    }
  }
  // END product_db wiring (phase 1)
  if (runId) {
    try {
      const stagingCount = await prisma.partStaging.count({ where: partStagingWhere(supplierId, templateId) })
      const seedCount = seeds.length
      console.log('[prepare-review-wirefix] before-diff', { supplierId, seedCount, stagingCount, runId })
      // Diagnostic log for staging scope prior to diff
      try {
        const tplForLog = options.templateId || options.notes?.replace(/^prepare:/, '') || 'n/a'
        await prisma.importLog.create({
          data: {
            templateId: tplForLog,
            runId,
            type: 'prepare:diagnostic:stagingScope',
            payload: { supplierId, templateId, seedCount, stagingCount },
          },
        })
      } catch {
        /* ignore logging errors */
      }
    } catch {
      /* noop */
    }
    await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
    await setProgress(runId, { status: 'diffing', phase: 'diff', percent: 80 })
    await throwIfCancelled(runId)
    await createDiffRowsForRun(supplierId, runId, { options, admin, templateId: templateId || undefined })
    if (options.skipSuccessful) {
      // Also mark previously successful externalIds as skipped (history ledger based on approvals)
      await markSkipSuccessfulForRun(supplierId, runId)
    }
    const counts = await countDiffsForRun(runId)
    await writeOptionsToRun(runId, options)
    await prisma.importRun.update({
      where: { id: runId },
      // Mark run as staged after diffs are materialized so Review can immediately show rows
      data: { status: 'staged', summary: { counts, options } as unknown as object },
    })
    // Minimal ImportTelemetry: record counts and duration when run reaches 'staged'
    try {
      const run = await prisma.importRun.findUnique({ where: { id: runId } })
      const startedAt = (run?.startedAt as Date | undefined) || new Date()
      const durationMs = Date.now() - new Date(startedAt).getTime()
      const newProducts = Number(counts.add || 0)
      const newVersions = Number(counts.change || 0)
      const skipped = Number(counts.skip || 0)
      await prisma.$executeRawUnsafe(
        'INSERT OR IGNORE INTO ImportTelemetry (id, runId, supplierId, newProducts, newVersions, skipped, failed, durationMs, startedAt, finishedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)',
        `imp-${runId}`,
        runId,
        supplierId,
        newProducts,
        newVersions,
        skipped,
        0,
        durationMs,
        startedAt,
      )
    } catch {
      /* best-effort */
    }
    // Post-diff summary diagnostics
    try {
      const tplForLog = options.templateId || options.notes?.replace(/^prepare:/, '') || 'n/a'
      await prisma.importLog.create({
        data: { templateId: tplForLog, runId, type: 'prepare:diagnostic:diffSummary', payload: { counts } },
      })
    } catch {
      /* ignore */
    }
    await setProgress(runId, { status: 'staged', phase: 'ready', percent: 100, details: { counts } })
    // Post-run consistency log: expectedItems (preflight) vs staged and diffs
    try {
      const run = await prisma.importRun.findUnique({ where: { id: runId } })
      const pre = ((run?.summary as unknown as { preflight?: { expectedItems?: number } }) || {}).preflight || {}
      const expectedItems = typeof pre.expectedItems === 'number' ? pre.expectedItems : undefined
      const stagedCount = await prisma.partStaging.count({ where: partStagingWhere(supplierId, templateId) })
      const diffCount = await prisma.importDiff.count({ where: { importRunId: runId } })
      await prisma.importLog.create({
        data: {
          templateId: options.templateId || options.notes?.replace(/^prepare:/, '') || 'n/a',
          runId,
          type: 'prepare:consistency',
          payload: { expectedItems, stagedCount, diffCount },
        },
      })
    } catch {
      /* ignore */
    }
    try {
      const diffCount = await prisma.importDiff.count({ where: { importRunId: runId } })
      console.log('[prepare-review-wirefix] after-diff', { supplierId, diffCount, runId })
    } catch {
      /* noop */
    }
    return runId
  } else {
    // Create a new run and then update with options merged
    const newRunId = await createRunFromStaging(supplierId, templateId || undefined)
    try {
      const stagingCount = await prisma.partStaging.count({ where: partStagingWhere(supplierId, templateId) })
      const seedCount = seeds.length
      console.log('[prepare-review-wirefix] before-diff', { supplierId, seedCount, stagingCount, runId: newRunId })
      // Diagnostic log for staging scope prior to diff (new run)
      try {
        const tplForLog = options.templateId || options.notes?.replace(/^prepare:/, '') || 'n/a'
        await prisma.importLog.create({
          data: {
            templateId: tplForLog,
            runId: newRunId,
            type: 'prepare:diagnostic:stagingScope',
            payload: { supplierId, templateId, seedCount, stagingCount },
          },
        })
      } catch {
        /* ignore */
      }
    } catch {
      /* noop */
    }
    await prisma.importDiff.deleteMany({ where: { importRunId: newRunId } })
    await setProgress(newRunId, { status: 'diffing', phase: 'diff', percent: 80 })
    await throwIfCancelled(newRunId)
    // BEGIN product_db wiring (phase 1) for new run path
    if (process.env.PRODUCT_DB_ENABLED === '1') {
      try {
        const stagingRows = await prisma.partStaging.findMany({ where: partStagingWhere(supplierId, templateId) })
        for (const r of stagingRows) {
          try {
            await upsertNormalizedProduct({
              supplier: { id: supplierId },
              sku: r.externalId,
              title: r.title,
              type: r.partType || null,
              description: (r.description as string | null) || null,
              images: (r.images as unknown as Prisma.InputJsonValue) || null,
              rawSpecs: (r.rawSpecs as unknown as Prisma.InputJsonValue) || null,
              normSpecs: (r.normSpecs as unknown as Prisma.InputJsonValue) || null,
              priceMsrp: r.priceMsrp != null ? Number(r.priceMsrp as unknown as number | string) : null,
              priceWholesale: r.priceWh != null ? Number(r.priceWh as unknown as number | string) : null,
              availability: (r as { availability?: string }).availability || null,
              sources: null,
              fetchedAt: r.fetchedAt || new Date(),
            })
          } catch (e) {
            const msg = (e as Error)?.message || String(e)
            if (Math.random() < 0.02) console.warn('[product_db_writer] upsert failed (sampled)', msg)
          }
        }
      } catch (e) {
        console.warn('[product_db_writer] bulk upsert staging -> product_db failed (non-fatal)', (e as Error)?.message)
      }
    }
    // END product_db wiring (phase 1)
    await createDiffRowsForRun(supplierId, newRunId, { options, admin, templateId: templateId || undefined })
    if (options.skipSuccessful) {
      await markSkipSuccessfulForRun(supplierId, newRunId)
    }
    const counts = await countDiffsForRun(newRunId)
    await prisma.importRun.update({
      where: { id: newRunId },
      // Mark run as staged after diffs are materialized
      data: { status: 'staged', summary: { counts, options } as unknown as object },
    })
    // Minimal ImportTelemetry on new run path
    try {
      const run = await prisma.importRun.findUnique({ where: { id: newRunId } })
      const startedAt = (run?.startedAt as Date | undefined) || new Date()
      const durationMs = Date.now() - new Date(startedAt).getTime()
      const newProducts = Number(counts.add || 0)
      const newVersions = Number(counts.change || 0)
      const skipped = Number(counts.skip || 0)
      await prisma.$executeRawUnsafe(
        'INSERT OR IGNORE INTO ImportTelemetry (id, runId, supplierId, newProducts, newVersions, skipped, failed, durationMs, startedAt, finishedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)',
        `imp-${newRunId}`,
        newRunId,
        supplierId,
        newProducts,
        newVersions,
        skipped,
        0,
        durationMs,
        startedAt,
      )
    } catch {
      /* best-effort */
    }
    // Post-diff summary diagnostics (new run)
    try {
      const tplForLog = options.templateId || options.notes?.replace(/^prepare:/, '') || 'n/a'
      await prisma.importLog.create({
        data: { templateId: tplForLog, runId: newRunId, type: 'prepare:diagnostic:diffSummary', payload: { counts } },
      })
    } catch {
      /* ignore */
    }
    await setProgress(newRunId, { status: 'staged', phase: 'ready', percent: 100, details: { counts } })
    // Post-run consistency log for new run
    try {
      const run = await prisma.importRun.findUnique({ where: { id: newRunId } })
      const pre = ((run?.summary as unknown as { preflight?: { expectedItems?: number } }) || {}).preflight || {}
      const expectedItems = typeof pre.expectedItems === 'number' ? pre.expectedItems : undefined
      const stagedCount = await prisma.partStaging.count({ where: partStagingWhere(supplierId, templateId) })
      const diffCount = await prisma.importDiff.count({ where: { importRunId: newRunId } })
      await prisma.importLog.create({
        data: {
          templateId: options.templateId || options.notes?.replace(/^prepare:/, '') || 'n/a',
          runId: newRunId,
          type: 'prepare:consistency',
          payload: { expectedItems, stagedCount, diffCount },
        },
      })
    } catch {
      /* ignore */
    }
    try {
      const diffCount = await prisma.importDiff.count({ where: { importRunId: newRunId } })
      console.log('[prepare-review-wirefix] after-diff', { supplierId, diffCount, runId: newRunId })
    } catch {
      /* noop */
    }
    return newRunId
  }
}
// <!-- END RBP GENERATED: scrape-template-wiring-v2 -->

async function createRunFromStaging(supplierId: string, templateId?: string): Promise<string> {
  // Mirror packages/importer/src/pipelines/diff.ts but return id and keep summary counts
  const counts = await generateCounts(supplierId, templateId)
  const run = await prisma.importRun.create({
    data: { supplierId, status: 'started', summary: { counts } as unknown as object },
  })
  await createDiffRowsForRun(supplierId, run.id, { templateId })
  return run.id
}

// Exported helper to compute diffs for an existing run id (used by launcher fallback to keep logs/run cohesive)
export async function diffStagingIntoExistingRun(supplierId: string, runId: string, opts?: { options?: RunOptions }) {
  const templateId = opts?.options?.templateId
  await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
  await createDiffRowsForRun(supplierId, runId, { options: opts?.options, templateId })
  const counts = await countDiffsForRun(runId)
  await writeOptionsToRun(runId, opts?.options || DEFAULT_OPTIONS)
  await prisma.importRun.update({
    where: { id: runId },
    // <!-- BEGIN RBP GENERATED: importer-prepare-review-wirefix-v1 -->
    // Ensure existing run moves to staged once diffs are recomputed
    data: { status: 'staged', summary: { counts, options: opts?.options || DEFAULT_OPTIONS } as unknown as object },
    // <!-- END RBP GENERATED: importer-prepare-review-wirefix-v1 -->
  })
  return counts
}

async function generateCounts(supplierId: string, templateId?: string): Promise<Record<string, number>> {
  let staging: Array<{
    externalId: string
    hashContent?: unknown
    title?: string
    partType?: string
    description?: string | null
    images?: unknown
    rawSpecs?: unknown
    normSpecs?: unknown
    priceMsrp?: unknown
    priceWh?: unknown
  }> = []
  staging = (await prisma.partStaging.findMany({ where: partStagingWhere(supplierId, templateId) })) as typeof staging
  const partsTableExists = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Part'`,
  )
  const existing = partsTableExists.length
    ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM Part WHERE supplierId = ?`, supplierId)
    : []
  const existingByExt = new Map(existing.map(p => [String((p as Record<string, unknown>)['externalId'] || ''), p]))
  const counts: Record<string, number> = {}
  for (const s of staging) {
    const before = existingByExt.get(s.externalId) || null
    if (!before) counts['add'] = (counts['add'] || 0) + 1
    else if (s.hashContent !== (before.hashContent || '')) counts['change'] = (counts['change'] || 0) + 1
  }
  for (const ex of existing) {
    if (!staging.find((s: { externalId: string }) => s.externalId === ex.externalId))
      counts['delete'] = (counts['delete'] || 0) + 1
  }
  return counts
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}
function buildHandle(supplierId: string, externalId: string) {
  return `rbp-${slugify(supplierId)}-${slugify(externalId)}`
}

async function fetchShopifyHash(admin: AdminClient, handle: string): Promise<string | null> {
  const GQL = `#graphql
    query ProductHash($q: String!) {
      products(first: 1, query: $q) {
        edges { node { id handle metafields(first: 25, namespace: "rbp") { edges { node { key value } } } } }
      }
    }
  `
  try {
    const resp = await admin.graphql(GQL, { variables: { q: `handle:${handle}` } })
    const data = (await resp.json()) as {
      data?: {
        products?: {
          edges?: Array<{
            node?: { handle?: string; metafields?: { edges?: Array<{ node?: { key?: string; value?: string } }> } }
          }>
        }
      }
    }
    const edges = data?.data?.products?.edges || []
    if (!edges.length) return null
    const mfs = edges[0]?.node?.metafields?.edges || []
    const mf = mfs.find(e => e.node?.key === 'hash')
    return (mf?.node?.value as string) || null
  } catch {
    return null
  }
}

async function createDiffRowsForRun(
  supplierId: string,
  runId: string,
  ctx?: { options?: RunOptions; admin?: AdminClient; templateId?: string },
) {
  let staging: Array<{
    externalId: string
    hashContent?: unknown
    title?: string
    partType?: string
    description?: string | null
    images?: unknown
    rawSpecs?: unknown
    normSpecs?: unknown
    priceMsrp?: unknown
    priceWh?: unknown
  }> = []
  staging = (await prisma.partStaging.findMany({
    where: partStagingWhere(supplierId, ctx?.templateId),
  })) as typeof staging
  const partsTableExists = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Part'`,
  )
  const existing = partsTableExists.length
    ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM Part WHERE supplierId = ?`, supplierId)
    : []
  const existingByExt = new Map(existing.map(p => [String((p as Record<string, unknown>)['externalId'] || ''), p]))
  const rows: {
    externalId: string
    diffType: 'add' | 'change' | 'delete'
    before: Prisma.InputJsonValue | null
    after: Prisma.InputJsonValue | null
  }[] = []
  const useSkip = Boolean(ctx?.options?.skipSuccessful && ctx?.admin)
  for (const s of staging) {
    const before = existingByExt.get(s.externalId) || null
    if (!before) {
      if (useSkip) {
        const handle = buildHandle(supplierId, s.externalId)
        const prevHash = await fetchShopifyHash(ctx!.admin!, handle)
        if (prevHash && prevHash === s.hashContent) {
          continue
        }
      }
      // Shape JSON payloads to avoid non-serializable fields (e.g., Dates)
      const after: Prisma.JsonObject = {
        title: s.title,
        partType: s.partType,
        description: s.description ?? null,
        images: (s.images as unknown as Prisma.JsonValue) ?? null,
        rawSpecs: (s.rawSpecs as unknown as Prisma.JsonValue) ?? null,
        normSpecs: (s.normSpecs as unknown as Prisma.JsonValue) ?? null,
        // Ensure JSON-safe primitives (Decimal -> number)
        priceMsrp: s.priceMsrp != null ? Number(s.priceMsrp as unknown as number | string) : null,
        priceWh: s.priceWh != null ? Number(s.priceWh as unknown as number | string) : null,
        // Avoid undefined in JSON payloads; use null or omit
        sourceUrl: null,
      }
      rows.push({ externalId: s.externalId, diffType: 'add', before: null, after })
    } else if (s.hashContent !== (before.hashContent || '')) {
      if (useSkip) {
        const handle = buildHandle(supplierId, s.externalId)
        const prevHash = await fetchShopifyHash(ctx!.admin!, handle)
        if (prevHash && prevHash === s.hashContent) {
          continue
        }
      }
      const beforeObj = before as Record<string, unknown>
      const beforeJson: Prisma.JsonObject = {
        title: (beforeObj['title'] as string) ?? null,
        partType: (beforeObj['partType'] as string) ?? null,
        description: (beforeObj['description'] as string) ?? null,
        images: (beforeObj['images'] as unknown as Prisma.JsonValue) ?? null,
        rawSpecs: (beforeObj['rawSpecs'] as unknown as Prisma.JsonValue) ?? null,
        normSpecs: (beforeObj['normSpecs'] as unknown as Prisma.JsonValue) ?? null,
        priceMsrp: beforeObj['priceMsrp'] != null ? Number(beforeObj['priceMsrp'] as unknown as number | string) : null,
        priceWh: beforeObj['priceWh'] != null ? Number(beforeObj['priceWh'] as unknown as number | string) : null,
        sourceUrl: (beforeObj['sourceUrl'] as string) ?? null,
      }
      const after: Prisma.JsonObject = {
        title: s.title,
        partType: s.partType,
        description: s.description ?? null,
        images: (s.images as unknown as Prisma.JsonValue) ?? null,
        rawSpecs: (s.rawSpecs as unknown as Prisma.JsonValue) ?? null,
        normSpecs: (s.normSpecs as unknown as Prisma.JsonValue) ?? null,
        priceMsrp: s.priceMsrp != null ? Number(s.priceMsrp as unknown as number | string) : null,
        priceWh: s.priceWh != null ? Number(s.priceWh as unknown as number | string) : null,
        // omit undefined fields to keep JSON serializable
      }
      rows.push({ externalId: s.externalId, diffType: 'change', before: beforeJson, after })
    }
  }
  for (const ex of existing) {
    const exId = String((ex as Record<string, unknown>)['externalId'] || '')
    if (!exId) continue
    if (!staging.find((s: { externalId: string }) => s.externalId === exId)) {
      const exObj = ex as Record<string, unknown>
      const beforeJson: Prisma.JsonObject = {
        title: (exObj['title'] as string) ?? null,
        partType: (exObj['partType'] as string) ?? null,
        description: (exObj['description'] as string) ?? null,
        images: (exObj['images'] as unknown as Prisma.JsonValue) ?? null,
        rawSpecs: (exObj['rawSpecs'] as unknown as Prisma.JsonValue) ?? null,
        normSpecs: (exObj['normSpecs'] as unknown as Prisma.JsonValue) ?? null,
        priceMsrp: exObj['priceMsrp'] != null ? Number(exObj['priceMsrp'] as unknown as number | string) : null,
        priceWh: exObj['priceWh'] != null ? Number(exObj['priceWh'] as unknown as number | string) : null,
        sourceUrl: (exObj['sourceUrl'] as string) ?? null,
      }
      rows.push({ externalId: exId, diffType: 'delete', before: beforeJson, after: null })
    }
  }
  if (rows.length) {
    await prisma.importDiff.createMany({
      data: rows.map(r => ({
        importRunId: runId,
        externalId: r.externalId,
        diffType: r.diffType,
        before: r.before as unknown as Prisma.InputJsonValue,
        after: r.after as unknown as Prisma.InputJsonValue,
      })),
    })
  }
  try {
    console.log('[createDiffRowsForRun] created rows', { supplierId, runId, count: rows.length })
  } catch {
    /* noop */
  }
}

async function countDiffsForRun(runId: string): Promise<Record<string, number>> {
  const add = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'add' } })
  const change = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'change' } })
  const del = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'delete' } })
  const conflict = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'conflict' } })
  return { add, change, delete: del, conflict }
}
