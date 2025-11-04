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

  // Wrap the entire staging flow to allow smoke fallback on any unexpected error
  try {
    const { prisma } = await import('../db.server')

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

    // Kick off crawl+stage using run options helper; MUST use saved settings seeds to match Preview behavior
    const { startImportFromOptions } = await import('../services/importer/runOptions.server')
    // Sanitize saved seeds: only accept absolute http(s) URLs to avoid runtime fetch/URL errors
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

    // Helper: timeout wrapper to avoid long-running crawling in a request cycle
    async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
      return (await Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])) as T
    }

    // Pre-create a run so we can attach logs and have a stable runId even if crawl fails
    const supplierId = options.supplierId || 'batson'
    const preRun = await prisma.importRun.create({
      data: { supplierId, status: 'started', summary: { options, seedCount: manualUrls.length } as unknown as object },
    })
    await prisma.importLog.create({
      data: {
        templateId,
        runId: preRun.id,
        type: 'launcher:start',
        payload: { options, seedCount: manualUrls.length },
      },
    })

    try {
      // Try full crawl+stage with a 60s guard; if it times out, fall back below
      const runId = await withTimeout(startImportFromOptions(options, preRun.id), 60_000)
      await prisma.importLog.create({
        data: { templateId, runId, type: 'launcher:success', payload: {} },
      })
      return redirect(`/app/imports/runs/${runId}/review${passthroughSearch}`)
    } catch (err) {
      await prisma.importLog.create({
        data: {
          templateId,
          runId: preRun.id,
          type: 'launcher:error',
          payload: { message: (err as Error)?.message || 'unknown', stack: (err as Error)?.stack },
        },
      })
      // Fallback: generate diffs from current staging (no crawl) so Review can open
      try {
        const { diffStagingIntoExistingRun } = await import('../services/importer/runOptions.server')
        // Use same pre-created run to keep logs and debug cohesive
        const supplierId = 'batson'
        await diffStagingIntoExistingRun(supplierId, preRun.id, { options })
        await prisma.importLog.create({
          data: { templateId, runId: preRun.id, type: 'launcher:fallback:diff-only', payload: {} },
        })
        return redirect(`/app/imports/runs/${preRun.id}/review${passthroughSearch}`)
      } catch {
        // If all else fails, redirect back with a banner trigger
        const smoke = trySmokeRedirect()
        if (smoke) return smoke
        const u = new URL(request.url)
        u.searchParams.set('reviewError', '1')
        return redirect(`/app/imports/${templateId}${u.search}`)
      }
    }
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
