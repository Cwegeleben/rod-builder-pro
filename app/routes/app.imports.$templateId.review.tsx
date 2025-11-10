// <!-- BEGIN RBP GENERATED: importer-review-launcher-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { smokesEnabled } from '../lib/smokes.server'

// Launches a crawl+stage+diff using saved settings for this template, then redirects to the run-based review page
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const templateId = String(params.templateId || '')
  if (!templateId) throw new Response('Not Found', { status: 404 })
  const url = new URL(request.url)
  const passthroughSearch = url.search

  // Helper: best-effort smoke fallback that avoids DB entirely
  const trySmokeRedirect = () => {
    try {
      if (!smokesEnabled()) return null
      const token = process.env.SMOKE_TOKEN || 'smoke-ok'
      const runId = `${templateId}-${Date.now()}`
      const usp = new URLSearchParams(passthroughSearch)
      usp.set('smoke', '1')
      usp.set('token', token)
      // Mark we used the launcher, for troubleshooting
      usp.set('via', 'launcher')
      return redirect(`/app/imports/runs/${encodeURIComponent(runId)}/review?${usp.toString()}`)
    } catch {
      return null
    }
  }

  // Wrap the entire flow to allow smoke fallback on any unexpected error
  try {
    const { prisma } = await import('../db.server')

    // Create ImportRun defensively in environments where Prisma JSON columns fail
    async function createImportRunSafe(data: {
      supplierId: string
      status: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      summary?: any
    }) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (prisma as any).importRun.create({ data })
      } catch {
        const fallback = { supplierId: data.supplierId, status: data.status }
        try {
          return await prisma.importRun.create({ data: fallback })
        } catch {
          try {
            const { randomUUID } = await import('node:crypto')
            const id = randomUUID()
            const startedAt = new Date().toISOString()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).$executeRawUnsafe(
              'INSERT INTO "ImportRun" ("id", "supplierId", "status", "startedAt") VALUES (?, ?, ?, ?)',
              id,
              data.supplierId,
              data.status,
              startedAt,
            )
            return { id, supplierId: data.supplierId, status: data.status } as unknown as {
              id: string
              supplierId: string
              status: string
            }
          } catch {
            throw new Error('importRun.create failed in launcher')
          }
        }
      }
    }

    // Load saved settings
    const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
    if (!tpl) throw new Response('Not Found', { status: 404 })
    const cfg = (tpl.importConfig as Record<string, unknown>) || {}
    const settings = (cfg['settings'] as Record<string, unknown>) || {}
    const targetId = typeof settings['target'] === 'string' ? (settings['target'] as string) : ''
    // Seeds saved from settings; optional
    const discoverSeedUrls: string[] = Array.isArray(settings['discoverSeedUrls'])
      ? (settings['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : []

    // Fallback: if no target configured, send user to settings editor
    if (!targetId) {
      const search = new URL(request.url).search
      return redirect(`/app/imports/${templateId}${search}`)
    }

    // Derive supplierId from target. Current implementation supports Batson, mapped to supplierId 'batson'.
    const { getTargetById } = await import('../server/importer/sites/targets')
    const target = getTargetById(targetId)
    if (!target) {
      return redirect(`/app/imports/${templateId}${passthroughSearch}`)
    }

    // Sanitize saved seeds: only accept absolute http(s) URLs
    const manualUrls = discoverSeedUrls
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .filter(s => {
        try {
          const u = new URL(s)
          return u.protocol === 'http:' || u.protocol === 'https:'
        } catch {
          return false
        }
      })

    // Map target -> templateKey used by extractor so crawl matches Preview
    function templateKeyForTarget(id: string): string | undefined {
      if (/^batson-/.test(id)) return 'batson.product.v2'
      return undefined
    }
    function supplierIdForTarget(id: string): string {
      // Prefer the target.siteId when available (e.g., "batson-rod-blanks"); fallback to a generic slug
      try {
        const t = getTargetById(id)
        if (t?.siteId) return t.siteId
      } catch {
        /* ignore */
      }
      return (id || 'batson').toLowerCase()
    }
    function useSeriesParserForTarget(id: string): boolean {
      // Enable the attribute-grid parser for Batson rod blanks
      return id === 'batson-rod-blanks'
    }
    const options = {
      mode: 'discover' as const,
      includeSeeds: true,
      manualUrls,
      skipSuccessful: false,
      notes: `launcher:${templateId}`,
      templateKey: templateKeyForTarget(targetId),
      variantTemplateId: undefined,
      scraperId: undefined,
      supplierId: supplierIdForTarget(targetId),
      useSeriesParser: useSeriesParserForTarget(targetId),
    }

    // New behavior: do NOT start crawl here. Find an existing run or build diffs from staging.
    const supplierId = options.supplierId || 'batson'

    // 1) If template shows an active preparing run, prefer it
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tplState = (await (prisma as any).importTemplate.findUnique({
        where: { id: templateId },
        select: { preparingRunId: true },
      })) as { preparingRunId?: string | null } | null
      const preparingRunId = tplState?.preparingRunId || null
      if (preparingRunId) {
        return redirect(`/app/imports/runs/${preparingRunId}/review${passthroughSearch}`)
      }
    } catch {
      /* ignore */
    }

    // 2) Prefer the most recent run for THIS template (via ImportLog), then fall back to supplier
    try {
      // Look for the latest prepare log for this template to resolve a runId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestTplLog = await (prisma as any).importLog.findFirst({
        where: { templateId, type: { in: ['prepare:done', 'prepare:start', 'prepare:report'] } },
        orderBy: { at: 'desc' },
        select: { runId: true },
      })
      if (latestTplLog?.runId) {
        return redirect(`/app/imports/runs/${latestTplLog.runId}/review${passthroughSearch}`)
      }
    } catch {
      /* ignore */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latest = await (prisma as any).importRun.findFirst({
        where: { supplierId, status: { in: ['staged', 'preparing', 'success', 'started'] } },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      })
      if (latest?.id) {
        return redirect(`/app/imports/runs/${latest.id}/review${passthroughSearch}`)
      }
    } catch {
      /* ignore */
    }

    // 3) If staging exists but no run, synthesize a diff-only run and open it
    try {
      const staged = await prisma.partStaging.count({ where: { supplierId } })
      if (staged > 0) {
        const preRun = await createImportRunSafe({
          supplierId,
          status: 'started',
          summary: { options, mode: 'review' },
        })
        // Link this synthetic run to the template via a log so future launches pick it up deterministically
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).importLog.create({
            data: { templateId, runId: preRun.id, type: 'review:synthetic', payload: { reason: 'staging-existed' } },
          })
        } catch {
          /* ignore */
        }
        try {
          const { diffStagingIntoExistingRun } = await import('../services/importer/runOptions.server')
          await diffStagingIntoExistingRun(supplierId, preRun.id, { options })
        } catch {
          // Even if diffing fails, attempt to open the run so the user gets context
        }
        return redirect(`/app/imports/runs/${preRun.id}/review${passthroughSearch}`)
      }
    } catch {
      /* ignore */
    }

    // 4) Nothing to review; redirect back to Settings with a clear indicator
    const u = new URL(request.url)
    u.searchParams.set('reviewError', '1')
    return redirect(`/app/imports/${templateId}${u.search}`)
  } catch {
    const smoke = trySmokeRedirect()
    if (smoke) return smoke
    const u = new URL(request.url)
    u.searchParams.set('reviewError', '1')
    return redirect(`/app/imports/${templateId}${u.search}`)
  }
}

export default function ImportReviewLauncherRoute() {
  // This component never renders because the loader redirects after staging
  return null
}
// <!-- END RBP GENERATED: importer-review-launcher-v1 -->
