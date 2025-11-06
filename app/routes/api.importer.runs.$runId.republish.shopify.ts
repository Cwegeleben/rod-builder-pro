// Selective re-publish: retry only failed publish diffs (rate-limited or metafield errors) or a provided subset
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import { authenticate } from '../shopify.server'
import { getShopAccessToken } from '../services/shopifyAdmin.server'
import { upsertShopifyForRun } from '../../packages/importer/src/sync/shopify'

function parseBody(req: Request): Promise<any> {
  return req.json().catch(() => ({}))
}

async function resolveShopDomain(request: Request): Promise<string | null> {
  // Prefer current admin session
  try {
    const { session } = await authenticate.admin(request)
    const s = (session as any)?.shop
    if (s) return s
  } catch {
    /* ignore */
  }
  let shopDomain = process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
  if (!shopDomain) {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    if (sess?.shop) shopDomain = sess.shop
  }
  return shopDomain || null
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ ok: false, error: 'Missing run id' }, { status: 400 })
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ ok: false, error: 'Run not found' }, { status: 404 })

  const body = await parseBody(request)
  const externalIds: string[] = Array.isArray(body?.externalIds) ? body.externalIds.map((x: any) => String(x)) : []
  const failedOnly = Boolean(body?.failedOnly) && externalIds.length === 0 // ignore failedOnly if explicit externalIds provided
  const approvedOnly = body?.approvedOnly !== false // default true

  // Load failing diffs if failedOnly requested
  let targetIds: string[] = externalIds
  if (failedOnly) {
    const failing = await prisma.importDiff.findMany({
      where: { importRunId: runId },
      select: { externalId: true, validation: true },
    })
    targetIds = failing
      .filter(d => {
        try {
          const v = d.validation as any
          const obj = typeof v === 'string' ? JSON.parse(v) : v || {}
          return !!obj?.publish?.error
        } catch {
          return false
        }
      })
      .map(d => String(d.externalId))
  }
  if (!targetIds.length && !failedOnly && !externalIds.length) {
    return json(
      { ok: false, error: 'No target externalIds provided and failedOnly not set or no failures present' },
      { status: 400 },
    )
  }

  const shopDomain = await resolveShopDomain(request)
  if (!shopDomain) return json({ ok: false, error: 'No shop domain configured' }, { status: 400 })
  const accessToken = await getShopAccessToken(shopDomain)

  // Execute scoped upsert
  type UpsertResult = { externalId: string; productId: number; handle: string; action: 'created' | 'updated' }
  const results: UpsertResult[] = await upsertShopifyForRun(runId, {
    shopName: shopDomain,
    accessToken,
    approvedOnly,
    deleteOverride: false,
    addsOnly: false,
    onlyExternalIds: targetIds,
    failedOnly,
  })

  // Recompute simple totals for these items (created/updated) and scan for remaining failures
  const created = results.filter(r => r.action === 'created').length
  const updated = results.filter(r => r.action === 'updated').length
  let remainingFailed = 0
  try {
    const rows = await prisma.importDiff.findMany({
      where: { importRunId: runId, externalId: { in: targetIds } },
      select: { validation: true },
    })
    remainingFailed = rows.filter(r => {
      try {
        const v = r.validation as any
        const obj = typeof v === 'string' ? JSON.parse(v) : v || {}
        return !!obj?.publish?.error
      } catch {
        return false
      }
    }).length
  } catch {
    /* ignore */
  }

  return json({
    ok: true,
    runId,
    shop: shopDomain,
    scope: { failedOnly, externalIds: targetIds },
    results,
    totals: { created, updated, remainingFailed },
  })
}

export default function ImporterRunRepublishShopifyApi() {
  return null
}
