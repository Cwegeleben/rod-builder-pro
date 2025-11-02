// hq-run-options-scrape-preview-v1
import { prisma } from '../../db.server'
import type { Prisma } from '@prisma/client'
import { markSkipSuccessfulForRun } from '../../../packages/importer/src/pipelines/diffWithSkip'
// <!-- BEGIN RBP GENERATED: scrape-template-wiring-v2 -->
import { crawlBatson } from '../../../packages/importer/src/crawlers/batsonCrawler'
import { fetchActiveSources, upsertProductSource } from '../../../packages/importer/src/seeds/sources'

export type RunOptions = {
  mode: 'price_avail'
  includeSeeds: boolean
  manualUrls: string[]
  skipSuccessful: boolean
  notes?: string
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  templateKey?: string
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
  // hq-importer-new-import-v2
  variantTemplateId?: string
  scraperId?: string
}

type ImportRunSummary = { counts?: Record<string, number>; options?: RunOptions }

const DEFAULT_OPTIONS: RunOptions = {
  mode: 'price_avail',
  includeSeeds: true,
  manualUrls: [],
  skipSuccessful: false,
  notes: '',
}

export function parseRunOptions(formData: FormData): RunOptions {
  const includeSeeds = formData.get('includeSeeds') === 'on'
  const skipSuccessful = formData.get('skipSuccessful') === 'on'
  const notes = String(formData.get('notes') || '')
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  const templateKey = String(formData.get('templateKey') || '').trim() || undefined
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
  // hq-importer-new-import-v2
  const variantTemplateId = String(formData.get('variantTemplateId') || '').trim() || undefined
  const scraperId = String(formData.get('scraperId') || '').trim() || undefined
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
    variantTemplateId,
    scraperId,
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
  const supplierId = 'batson'
  // Record manual URLs as sources
  for (const url of options.manualUrls) {
    await upsertProductSource(supplierId, url, 'manual', options.notes)
  }
  // Compose seeds
  const saved = options.includeSeeds ? (await fetchActiveSources(supplierId)).map((s: { url: string }) => s.url) : []
  const seeds = Array.from(new Set([...saved, ...options.manualUrls]))
  // Crawl and stage (honor template + polite defaults)
  await crawlBatson(seeds, {
    templateKey: options.templateKey,
    // Conservative defaults for Fly Machines with headless Chromium
    politeness: { jitterMs: [300, 800], maxConcurrency: 1, rpm: 30, blockAssetsOnLists: true },
  })
  // Generate diffs
  if (runId) {
    await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
    await createDiffRowsForRun(supplierId, runId, { options, admin })
    if (options.skipSuccessful) {
      // Also mark previously successful externalIds as skipped (history ledger based on approvals)
      await markSkipSuccessfulForRun(supplierId, runId)
    }
    const counts = await countDiffsForRun(runId)
    await writeOptionsToRun(runId, options)
    await prisma.importRun.update({
      where: { id: runId },
      data: { status: 'started', summary: { counts, options } as unknown as object },
    })
    return runId
  } else {
    // Create a new run and then update with options merged
    const newRunId = await createRunFromStaging(supplierId)
    await prisma.importDiff.deleteMany({ where: { importRunId: newRunId } })
    await createDiffRowsForRun(supplierId, newRunId, { options, admin })
    if (options.skipSuccessful) {
      await markSkipSuccessfulForRun(supplierId, newRunId)
    }
    const counts = await countDiffsForRun(newRunId)
    await prisma.importRun.update({
      where: { id: newRunId },
      data: { status: 'started', summary: { counts, options } as unknown as object },
    })
    return newRunId
  }
}
// <!-- END RBP GENERATED: scrape-template-wiring-v2 -->

async function createRunFromStaging(supplierId: string): Promise<string> {
  // Mirror packages/importer/src/pipelines/diff.ts but return id and keep summary counts
  const counts = await generateCounts(supplierId)
  const run = await prisma.importRun.create({
    data: { supplierId, status: 'started', summary: { counts } as unknown as object },
  })
  await createDiffRowsForRun(supplierId, run.id)
  return run.id
}

// Exported helper to compute diffs for an existing run id (used by launcher fallback to keep logs/run cohesive)
export async function diffStagingIntoExistingRun(supplierId: string, runId: string, opts?: { options?: RunOptions }) {
  await prisma.importDiff.deleteMany({ where: { importRunId: runId } })
  await createDiffRowsForRun(supplierId, runId, { options: opts?.options })
  const counts = await countDiffsForRun(runId)
  await writeOptionsToRun(runId, opts?.options || DEFAULT_OPTIONS)
  await prisma.importRun.update({
    where: { id: runId },
    data: { status: 'started', summary: { counts, options: opts?.options || DEFAULT_OPTIONS } as unknown as object },
  })
  return counts
}

async function generateCounts(supplierId: string): Promise<Record<string, number>> {
  const staging = await prisma.partStaging.findMany({ where: { supplierId } })
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
    if (!staging.find(s => s.externalId === ex.externalId)) counts['delete'] = (counts['delete'] || 0) + 1
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
  ctx?: { options?: RunOptions; admin?: AdminClient },
) {
  const staging = await prisma.partStaging.findMany({ where: { supplierId } })
  const partsTableExists = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Part'`,
  )
  const existing = partsTableExists.length
    ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM Part WHERE supplierId = ?`, supplierId)
    : []
  const existingByExt = new Map(existing.map(p => [String((p as Record<string, unknown>)['externalId'] || ''), p]))
  const rows: { externalId: string; diffType: 'add' | 'change' | 'delete'; before: unknown; after: unknown }[] = []
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
      rows.push({ externalId: s.externalId, diffType: 'add', before: null, after: s })
    } else if (s.hashContent !== (before.hashContent || '')) {
      if (useSkip) {
        const handle = buildHandle(supplierId, s.externalId)
        const prevHash = await fetchShopifyHash(ctx!.admin!, handle)
        if (prevHash && prevHash === s.hashContent) {
          continue
        }
      }
      rows.push({ externalId: s.externalId, diffType: 'change', before, after: s })
    }
  }
  for (const ex of existing) {
    const exId = String((ex as Record<string, unknown>)['externalId'] || '')
    if (!exId) continue
    if (!staging.find(s => s.externalId === exId))
      rows.push({ externalId: exId, diffType: 'delete', before: ex, after: null })
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
}

async function countDiffsForRun(runId: string): Promise<Record<string, number>> {
  const add = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'add' } })
  const change = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'change' } })
  const del = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'delete' } })
  const conflict = await prisma.importDiff.count({ where: { importRunId: runId, diffType: 'conflict' } })
  return { add, change, delete: del, conflict }
}
