// <!-- BEGIN RBP GENERATED: importer-review-debug-api-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import Shopify from 'shopify-api-node'
import { getShopAccessToken } from '../services/shopifyAdmin.server'
import { authenticate } from '../shopify.server'

type PrismaLikeError = {
  code?: string
  message?: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const { prisma } = await import('../db.server')

  // Optional: include Shopify metafields summary for each published product
  const url = new URL(request.url)
  const includeMetafields = url.searchParams.has('includeMetafields') || url.searchParams.get('metas') === '1'
  const includeMetafieldsFull =
    url.searchParams.get('metas') === 'full' || url.searchParams.get('includeMetafields') === 'full'

  async function getShopDomainFromRequest(req: Request): Promise<string | null> {
    try {
      const { session } = await authenticate.admin(req)
      const s = (session as unknown as { shop?: string }).shop
      if (s) return s
    } catch {
      // ignore
    }
    let shopDomain = process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
    if (!shopDomain) {
      const sess = await prisma.session.findFirst({ where: { isOnline: false } })
      if (sess?.shop) shopDomain = sess.shop
    }
    return shopDomain || null
  }

  // Try Prisma first; if JSON columns are incompatible on this SQLite (P2023),
  // fall back to raw SQL and manual JSON parsing to avoid 500s in prod.
  try {
    // step: prisma.run
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return json({ error: 'Not found' }, { status: 404 })
    // step: prisma.logs
    const logs = await prisma.importLog.findMany({
      where: { runId },
      orderBy: { at: 'desc' },
      take: 50,
      select: { id: true, type: true, at: true, payload: true },
    })
    // Recent diffs with publish diagnostics snapshot
    // step: prisma.diffs
    const diffs = await prisma.importDiff.findMany({
      where: { importRunId: runId },
      take: 20,
      select: { id: true, externalId: true, diffType: true, resolution: true, validation: true },
    })
    const asRecord = (u: unknown): Record<string, unknown> =>
      u && typeof u === 'object' ? (u as Record<string, unknown>) : {}
    // step: shape.publish
    const publish = diffs.map(d => {
      const vAll = asRecord(d.validation as unknown)
      const v = asRecord((vAll as { publish?: unknown }).publish)
      const keep: Record<string, unknown> = {
        id: d.id,
        externalId: d.externalId,
        diffType: d.diffType,
        resolution: d.resolution,
        action: v.action as string | undefined,
        skipReason: v.skipReason as string | undefined,
        at: v.at as string | undefined,
        productId: v.productId as number | string | undefined,
        handle: v.handle as string | undefined,
        status: v.status as string | undefined,
        webUrl: v.webUrl as string | undefined,
        specOk: v.specOk as boolean | undefined,
        specMissingKeys: v.specMissingKeys as unknown,
        metafieldWarnings: v.metafieldWarnings,
        metafieldErrors: v.metafieldErrors,
        publishWarnings: v.publishWarnings,
        variantError: v.variantError as string | undefined,
        imageErrors: v.imageErrors,
        error: v.error as string | undefined,
        detail: v.detail,
      }
      return keep
    })
    // If requested, augment publish diagnostics with per-product metafields summary from Shopify
    if (includeMetafields || includeMetafieldsFull) {
      try {
        const shopDomain = await getShopDomainFromRequest(request)
        if (shopDomain) {
          const accessToken = await getShopAccessToken(shopDomain)
          const shopify = new Shopify({ shopName: shopDomain, accessToken, apiVersion: '2024-10' })
          for (const p of publish) {
            const pid = Number(p.productId)
            if (!pid || Number.isNaN(pid)) continue
            try {
              const mfs: any[] = await (shopify as any).metafield.list({
                metafield: { owner_resource: 'product', owner_id: pid },
                limit: 250,
              })
              const specs = mfs.filter(m => m.namespace === 'rbp_spec')
              const rbp = mfs.filter(m => m.namespace === 'rbp')
              const pickKeys = new Set(['series', 'length_in', 'pieces', 'action', 'power', 'material'])
              const specPairs = specs
                .filter(m => pickKeys.has(String(m.key)))
                .map(m => [String(m.key), String(m.value)])
              const specSummary = Object.fromEntries(specPairs)
              const specsCount = specs.length
              const hasSpecsJson = rbp.some(m => m.key === 'specs')
              const hasUnknownKeys = rbp.some(m => m.key === 'unknown_spec_keys')
              ;(p as any).metafieldsSummary = {
                rbp_spec_count: specsCount,
                rbp_spec_core: specSummary,
                rbp_has_specs_json: hasSpecsJson,
                rbp_has_unknown_spec_keys: hasUnknownKeys,
              }
              if (includeMetafieldsFull) {
                const rbpSpecAll = specs.map(m => ({
                  key: String(m.key),
                  type: String(m.type),
                  value: String(m.value),
                }))
                // For rbp namespace, avoid dumping huge JSON; expose present keys and a core summary from specs JSON
                const rbpKeys = rbp.map(m => String(m.key))
                let rbpSpecsCore: Record<string, string> | undefined
                try {
                  const specsMf = rbp.find(m => m.key === 'specs')
                  if (specsMf && typeof specsMf.value === 'string') {
                    const obj = JSON.parse(specsMf.value)
                    const coreKeys = ['series', 'length_in', 'pieces', 'action', 'power', 'material']
                    const core: Record<string, string> = {}
                    for (const k of coreKeys) {
                      const v = obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined
                      if (v !== undefined && v !== null) core[k] = String(v)
                    }
                    rbpSpecsCore = core
                  }
                } catch {
                  rbpSpecsCore = undefined
                }
                // Assign full details
                ;(p as any).metafieldsFull = {
                  rbp_spec_all: rbpSpecAll,
                  rbp_keys: rbpKeys,
                  rbp_specs_core_json: rbpSpecsCore,
                }
              }
            } catch {
              // ignore per-product metafield issues
            }
          }
        }
      } catch {
        // ignore overall metafield enrichment errors
      }
    }
    // step: coverage.aggregate
    // Compute aggregate coverage metrics across publish diagnostics (after per-product enrichment)
    try {
      const coverage = (() => {
        const coreKeys = ['series', 'length_in', 'pieces', 'action', 'power', 'material']
        let productsWithAny = 0
        let productsWithAllCore = 0
        let productsWithSpecsJson = 0
        let productsWithUnknownKeys = 0
        const perKey: Record<string, number> = {}
        for (const k of coreKeys) perKey[k] = 0
        for (const p of publish) {
          const mf = (p as any).metafieldsSummary as
            | undefined
            | {
                rbp_spec_core?: Record<string, string>
                rbp_has_specs_json?: boolean
                rbp_has_unknown_spec_keys?: boolean
              }
          if (!mf) continue
          const core = mf.rbp_spec_core || {}
          const presentCore = Object.keys(core)
          if (presentCore.length) productsWithAny++
          let all = true
          for (const ck of coreKeys) {
            if (core[ck] != null) perKey[ck]++
            else all = false
          }
          if (all) productsWithAllCore++
          if (mf.rbp_has_specs_json) productsWithSpecsJson++
          if (mf.rbp_has_unknown_spec_keys) productsWithUnknownKeys++
        }
        const total = publish.length || 0
        return {
          totalProducts: total,
          productsWithAnyCoreSpec: productsWithAny,
          productsWithAllCoreSpecs: productsWithAllCore,
          productsWithSpecsJson,
          productsWithUnknownKeys,
          perKey,
        }
      })()
      ;(run as any).summary = {
        ...(run.summary as object),
        coverage,
      } as object
    } catch {
      /* ignore coverage aggregation errors */
    }
    // step: response
    // Also surface header skip metrics and sample items if present in run.summary or recent logs
    const headerSkip = (() => {
      try {
        const s = (run.summary as unknown as { counts?: Record<string, number> } | null) || null
        return s?.counts?.headerSkip || 0
      } catch {
        return 0
      }
    })()
    const headerSamples = logs
      .filter(l => l.type === 'crawl:headers')
      .flatMap(l => {
        const p =
          (l.payload as unknown as { headerSkips?: Array<{ externalId: string; reason: string; url: string }> }) || {}
        return p.headerSkips || []
      })
      .slice(0, 10)
    return json({
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        summary: run.summary,
      },
      logs,
      publish,
      headerSkip,
      headerSamples,
      source: 'prisma',
    })
  } catch (err) {
    // Prisma path failed; include step hint if available
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Proceed to raw fallback below; if that also fails, we return the raw error
    // Any Prisma failure -> attempt raw SQL fallback to avoid opaque errors in production
    try {
      // step: raw.run
      const rows = await prisma.$queryRawUnsafe<
        Array<{ id: string; status: string; startedAt: string; finishedAt: string | null; summary: unknown }>
      >('SELECT id, status, startedAt, finishedAt, summary FROM ImportRun WHERE id = ? LIMIT 1', runId)
      const row = rows?.[0]
      if (!row) return json({ error: 'Not found' }, { status: 404 })
      let summary: unknown = null
      try {
        // In SQLite the column stores TEXT; parse if it looks like JSON
        if (typeof row.summary === 'string') summary = JSON.parse(row.summary)
        else summary = row.summary ?? null
      } catch {
        summary = row.summary ?? null
      }

      // step: raw.logs
      const logRows = await prisma.$queryRawUnsafe<Array<{ id: string; type: string; at: string; payload: unknown }>>(
        'SELECT id, type, at, payload FROM ImportLog WHERE runId = ? ORDER BY at DESC LIMIT 50',
        runId,
      )
      const logs = logRows.map(lr => {
        let payload: unknown = null
        try {
          if (typeof lr.payload === 'string') payload = JSON.parse(lr.payload)
          else payload = lr.payload ?? null
        } catch {
          payload = lr.payload ?? null
        }
        return { id: lr.id, type: lr.type, at: lr.at, payload }
      })

      // Recent diffs (raw) with publish diagnostics snapshot
      // step: raw.diffs
      const diffRows = await prisma.$queryRawUnsafe<
        Array<{ id: string; externalId: string; diffType: string; resolution: string | null; validation: unknown }>
      >(
        'SELECT id, externalId, diffType, resolution, validation FROM ImportDiff WHERE importRunId = ? ORDER BY rowid DESC LIMIT 20',
        runId,
      )
      // step: raw.shape.publish
      const publish = diffRows.map(d => {
        let v: unknown = {}
        try {
          const val = d.validation as unknown
          if (typeof val === 'string') v = JSON.parse(val)
          else v = val ?? {}
        } catch {
          v = (d.validation as unknown) ?? {}
        }
        const asRecord = (u: unknown): Record<string, unknown> =>
          u && typeof u === 'object' ? (u as Record<string, unknown>) : {}
        const p = asRecord(asRecord(v).publish)
        return {
          id: d.id,
          externalId: d.externalId,
          diffType: d.diffType,
          resolution: d.resolution,
          action: p.action as unknown as string | undefined,
          skipReason: p.skipReason as unknown as string | undefined,
          at: p.at as string | undefined,
          productId: p.productId as number | string | undefined,
          handle: p.handle as string | undefined,
          status: p.status as string | undefined,
          webUrl: p.webUrl as string | undefined,
          specOk: p.specOk as boolean | undefined,
          specMissingKeys: p.specMissingKeys as unknown,
          metafieldWarnings: p.metafieldWarnings,
          metafieldErrors: p.metafieldErrors,
          publishWarnings: p.publishWarnings,
          variantError: p.variantError as string | undefined,
          imageErrors: p.imageErrors,
          error: p.error as string | undefined,
          detail: p.detail,
        }
      })

      // step: coverage.aggregate.raw
      let coverage: unknown = undefined
      try {
        const enriched = publish.filter(p => (p as any).metafieldsSummary)
        if (enriched.length) {
          const coreKeys = ['series', 'length_in', 'pieces', 'action', 'power', 'material']
          let productsWithAny = 0
          let productsWithAllCore = 0
          let productsWithSpecsJson = 0
          let productsWithUnknownKeys = 0
          const perKey: Record<string, number> = {}
          for (const k of coreKeys) perKey[k] = 0
          for (const p of enriched) {
            const mf = (p as any).metafieldsSummary as {
              rbp_spec_core?: Record<string, string>
              rbp_has_specs_json?: boolean
              rbp_has_unknown_spec_keys?: boolean
            }
            const core = mf.rbp_spec_core || {}
            const presentCore = Object.keys(core)
            if (presentCore.length) productsWithAny++
            let all = true
            for (const ck of coreKeys) {
              if (core[ck] != null) perKey[ck]++
              else all = false
            }
            if (all) productsWithAllCore++
            if (mf.rbp_has_specs_json) productsWithSpecsJson++
            if (mf.rbp_has_unknown_spec_keys) productsWithUnknownKeys++
          }
          coverage = {
            totalProducts: publish.length || 0,
            productsWithAnyCoreSpec: productsWithAny,
            productsWithAllCoreSpecs: productsWithAllCore,
            productsWithSpecsJson,
            productsWithUnknownKeys,
            perKey,
          }
        }
      } catch {
        coverage = undefined
      }
      // step: response
      const headerSkip = (() => {
        try {
          const s = (summary as unknown as { counts?: Record<string, number> } | null) || null
          return s?.counts?.headerSkip || 0
        } catch {
          return 0
        }
      })()
      const headerSamples = logs
        .filter(l => l.type === 'crawl:headers')
        .flatMap(l => {
          const p =
            (l.payload as unknown as { headerSkips?: Array<{ externalId: string; reason: string; url: string }> }) || {}
          return p.headerSkips || []
        })
        .slice(0, 10)
      return json({
        run: {
          id: row.id,
          status: row.status,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          summary: { ...(summary as object), coverage },
        },
        logs,
        publish,
        headerSkip,
        headerSamples,
        source: 'raw',
      })
    } catch (rawErr) {
      const e = rawErr as PrismaLikeError
      const rawMessage = e && typeof e.message === 'string' ? e.message : 'Unknown error'
      // Return a 200 with an error payload so UI can show the error step without treating it as a generic network failure
      return json(
        { ok: false, error: rawMessage, note: 'prisma failed then raw failed', prismaError: message },
        { status: 200 },
      )
    }
  }
}

export default function ImporterRunDebugApi() {
  return null
}
// <!-- END RBP GENERATED: importer-review-debug-api-v1 -->
