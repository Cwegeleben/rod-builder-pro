import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { DesignBuildStatus } from '@prisma/client'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadRecentDesignBuildSummaries } from '../lib/designStudio/builds.server'
import { createDesignStorefrontBuild } from '../services/designStudio/storefrontBuild.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: buildShopifyCorsHeaders(request) })
  }
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ error: access.reason }, { status: 403, headers: buildShopifyCorsHeaders(request) })
  }

  const formData = await request.formData()
  const rawPayload = formData.get('payload')
  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return json({ error: 'INVALID_PAYLOAD' }, { status: 400, headers: buildShopifyCorsHeaders(request) })
  }
  const draftTokenValue = formData.get('draftToken')
  const draftToken = typeof draftTokenValue === 'string' && draftTokenValue.trim() ? draftTokenValue.trim() : null

  let payload
  try {
    payload = JSON.parse(rawPayload)
  } catch {
    return json({ error: 'INVALID_JSON' }, { status: 400, headers: buildShopifyCorsHeaders(request) })
  }

  try {
    const result = await createDesignStorefrontBuild({ access, payload, draftToken })
    return json(
      { ok: true, buildId: result.id, reference: result.reference },
      { headers: buildShopifyCorsHeaders(request) },
    )
  } catch (error) {
    console.error('[designStudio] Failed to create storefront build', error)
    return json(
      { ok: false, error: 'BUILD_CREATION_FAILED' },
      { status: 500, headers: buildShopifyCorsHeaders(request) },
    )
  }
}

const TIMELINE_DEFAULT_STATUSES: DesignBuildStatus[] = ['APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'FULFILLED']
const STATUS_ALLOWLIST = new Set<DesignBuildStatus>([
  ...TIMELINE_DEFAULT_STATUSES,
  'REVIEW',
  'BLOCKED',
  'ARCHIVED',
  'DRAFT',
])

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = buildShopifyCorsHeaders(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    return json({ builds: [] }, { status: 403, headers })
  }
  const url = new URL(request.url)
  const statuses = parseStatuses(url.searchParams) ?? TIMELINE_DEFAULT_STATUSES
  if (!statuses.length) {
    return json({ builds: [] }, { headers })
  }
  const take = clampTimelineTake(Number(url.searchParams.get('limit')))
  try {
    const builds = await loadRecentDesignBuildSummaries({ shopDomain: access.shopDomain, statuses, take })
    return json({ builds }, { headers })
  } catch (error) {
    console.error('[designStudio] Failed to load build timeline', error)
    return json({ builds: [] }, { status: 500, headers })
  }
}

function parseStatuses(params: URLSearchParams): DesignBuildStatus[] | null {
  const entries = params.getAll('status')
  if (!entries.length) return null
  const normalized: DesignBuildStatus[] = []
  entries.forEach(value => {
    const upper = value?.toUpperCase()
    if (!upper) return
    if (STATUS_ALLOWLIST.has(upper as DesignBuildStatus)) {
      normalized.push(upper as DesignBuildStatus)
    }
  })
  return normalized
}

function clampTimelineTake(raw: number | null): number {
  if (!raw || !Number.isFinite(raw)) return 3
  return Math.max(1, Math.min(3, Math.floor(raw)))
}
