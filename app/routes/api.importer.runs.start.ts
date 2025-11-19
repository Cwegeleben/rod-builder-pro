// HQ-only endpoint to start an importer run without smoke gating
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { startImportFromOptions, type RunOptions } from '../services/importer/runOptions.server'
import { authenticate } from '../shopify.server'

type StartBody = {
  supplierId?: string
  manualUrls?: string[]
  skipSuccessful?: boolean
  templateKey?: string
  useSeriesParser?: boolean
  notes?: string
  // Extended optional controls
  pipeline?: 'simple' | 'full'
  includeSeedsOnly?: boolean
  limit?: number
  overrideSeries?: string
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  let body: StartBody = {}
  try {
    body = (await request.json()) as StartBody
  } catch {
    // allow empty body
  }
  const supplierId = (body.supplierId || '').trim() || 'batson-rod-blanks'
  const manualUrls = Array.isArray(body.manualUrls) ? body.manualUrls.filter(Boolean) : []
  const skipSuccessful = Boolean(body.skipSuccessful)
  const templateKey = (body.templateKey || '').trim() || undefined
  const useSeriesParser = Boolean(body.useSeriesParser)
  const notes = (body.notes || '').trim() || 'hq:start'
  const pipeline = body.pipeline === 'full' ? 'full' : body.pipeline === 'simple' ? 'simple' : undefined
  const includeSeedsOnly = Boolean(body.includeSeedsOnly)
  const limit = typeof body.limit === 'number' && isFinite(body.limit) && body.limit > 0 ? body.limit : undefined
  const overrideSeries = (body.overrideSeries || '').trim() || undefined

  const options: RunOptions = {
    mode: 'discover',
    includeSeeds: true,
    manualUrls,
    skipSuccessful,
    notes,
    supplierId,
    templateKey,
    variantTemplateId: undefined,
    scraperId: undefined,
    useSeriesParser,
    pipeline,
    includeSeedsOnly,
    limit,
    overrideSeries,
  }

  try {
    // Prefer passing admin for optional Shopify hash lookups in skipSuccessful mode
    let admin: { graphql: (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response> } | undefined
    try {
      const { admin: a } = await authenticate.admin(request)
      admin = a
    } catch {
      admin = undefined
    }
    const runId = await startImportFromOptions(options, undefined, admin)
    return json({ ok: true, runId, supplierId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start run'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export default function ApiImporterRunsStart() {
  return null
}
