// <!-- BEGIN RBP GENERATED: importer-review-launcher-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

// Launches a crawl+stage+diff using saved settings for this template, then redirects to the run-based review page
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const templateId = String(params.templateId || '')
  if (!templateId) throw new Response('Not Found', { status: 404 })
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
    const search = new URL(request.url).search
    return redirect(`/app/imports/${templateId}${search}`)
  }

  // Kick off crawl+stage using run options helper; MUST use saved settings seeds to match Preview behavior
  const { startImportFromOptions } = await import('../services/importer/runOptions.server')
  const manualUrls = discoverSeedUrls.filter(Boolean)
  if (!manualUrls.length) {
    // No saved seeds; redirect back to settings to configure seeds via Discover/Preview
    const url = new URL(request.url)
    url.searchParams.set('reviewError', 'need-seeds')
    return redirect(`/app/imports/${templateId}${url.search}`)
  }

  // Map target -> templateKey used by extractor so crawl matches Preview
  function templateKeyForTarget(id: string): string | undefined {
    if (/^batson-/.test(id)) return 'batson.product.v2'
    return undefined
  }
  const options = {
    mode: 'price_avail' as const,
    includeSeeds: true,
    manualUrls,
    skipSuccessful: false,
    notes: `launcher:${templateId}`,
    templateKey: templateKeyForTarget(targetId),
    variantTemplateId: undefined,
    scraperId: undefined,
  }

  // Helper: timeout wrapper to avoid long-running crawling in a request cycle
  async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return (await Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])) as T
  }

  // Pre-create a run so we can attach logs and have a stable runId even if crawl fails
  const supplierId = 'batson'
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
    const search = new URL(request.url).search
    return redirect(`/app/imports/runs/${runId}/review${search}`)
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
      const search = new URL(request.url).search
      return redirect(`/app/imports/runs/${preRun.id}/review${search}`)
    } catch {
      // If all else fails, redirect back with a banner trigger
      const url = new URL(request.url)
      url.searchParams.set('reviewError', '1')
      return redirect(`/app/imports/${templateId}${url.search}`)
    }
  }
}

export default function ImportReviewLauncherRoute() {
  // This component never renders because the loader redirects after staging
  return null
}
// <!-- END RBP GENERATED: importer-review-launcher-v1 -->
