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

  // Kick off crawl+stage using run options helper; include saved seeds and saved target template key if applicable
  const { startImportFromOptions } = await import('../services/importer/runOptions.server')
  const options = {
    mode: 'price_avail' as const,
    includeSeeds: true,
    manualUrls: discoverSeedUrls,
    skipSuccessful: false,
    notes: `launcher:${templateId}`,
    templateKey: undefined,
    variantTemplateId: undefined,
    scraperId: undefined,
  }
  try {
    const runId = await startImportFromOptions(options)
    const search = new URL(request.url).search
    return redirect(`/app/imports/runs/${runId}/review${search}`)
  } catch {
    // If staging fails, redirect back to settings so the user can adjust configuration
    const search = new URL(request.url).search
    return redirect(`/app/imports/${templateId}${search}`)
  }
}

export default function ImportReviewLauncherRoute() {
  // This component never renders because the loader redirects after staging
  return null
}
// <!-- END RBP GENERATED: importer-review-launcher-v1 -->
