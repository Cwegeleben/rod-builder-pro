// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
// Extend existing API to support listing ImportTemplate rows
// Usage: GET /app/api/importer/templates?kind=import-templates
// Returns: { templates: Array<{ id,name,state,hadFailures,lastRunAt? }> }
// Integrated below in the main loader.
// <!-- END RBP GENERATED: importer-v2-3 -->
// hq-importer-new-import-v2
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { listTemplatesSummary } from '../models/specTemplate.server'
import { listScrapers } from '../services/importer/scrapers.server'
import { authenticate } from '../shopify.server'

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS: allow Shopify Admin parent frame to fetch when App Bridge proxies
  const origin = request.headers.get('origin') || ''
  const allowOrigins = ['https://admin.shopify.com', 'https://rbp-app.fly.dev', 'http://localhost:3000']
  const allowOrigin = allowOrigins.find(o => origin.startsWith(o)) || '*'
  const baseHeaders = new Headers({
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    Vary: 'Origin',
  })
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders })
  }
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const kind = (url.searchParams.get('kind') || '').toLowerCase()
  // <!-- BEGIN RBP GENERATED: importer-v2-3 -->
  if (kind === 'import-templates' || kind === 'imports') {
    const { prisma } = await import('../db.server')
    try {
      const rows = await (prisma as any).importTemplate.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, state: true, hadFailures: true, lastRunAt: true, preparingRunId: true },
      })
      // Enrich with preparing snapshot from ImportRun
      const preparingIds = rows.filter((r: any) => r.preparingRunId).map((r: any) => r.preparingRunId as string)
      const prepRuns = preparingIds.length
        ? await (prisma as any).importRun.findMany({
            where: { id: { in: preparingIds } },
            select: { id: true, startedAt: true, summary: true },
          })
        : []
      const prepById = Object.fromEntries(
        prepRuns.map((r: any) => [r.id, { startedAt: r.startedAt, preflight: (r.summary as any)?.preflight || null }]),
      )
      const out = rows.map((r: any) => {
        const prep = r.preparingRunId ? prepById[r.preparingRunId] || null : null
        const preparing =
          r.preparingRunId && prep
            ? {
                runId: r.preparingRunId as string,
                startedAt: prep.startedAt as Date,
                etaSeconds: (prep.preflight?.etaSeconds as number) || undefined,
              }
            : null
        const rest = { ...r }
        delete (rest as any).preparingRunId
        return { ...rest, preparing }
      })
      return new Response(JSON.stringify({ templates: out }), {
        headers: new Headers({ 'Content-Type': 'application/json', ...Object.fromEntries(baseHeaders) }),
      })
    } catch (err) {
      console.warn('[api.importer.templates] failed to list templates; returning empty list:', err)
      return new Response(JSON.stringify({ templates: [] }), {
        headers: new Headers({ 'Content-Type': 'application/json', ...Object.fromEntries(baseHeaders) }),
      })
    }
  }
  // <!-- END RBP GENERATED: importer-v2-3 -->
  if (kind === 'variant') {
    const tpls = await listTemplatesSummary()
    return json(
      tpls.map(t => ({ id: t.id, name: t.name, kind: 'variant', fields: t.fieldsCount, variantsSummary: 'TBD' })),
    )
  }
  if (kind === 'scraper') {
    const scrapers = await listScrapers()
    return json(scrapers)
  }
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  if (kind === 'variant-remote') {
    const { admin } = await authenticate.admin(request)
    const TYPE = 'rbp_template'
    const first = 100
    let after: string | null = null
    const out: Array<{
      id: string
      hasPrice: boolean
      hasPrimaryVariantCost: boolean
      hasProductImageUrl: boolean
      hasSupplierAvailability: boolean
    }> = []
    const GQL = `#graphql
      query List($type: String!, $first: Int!, $after: String) {
        metaobjects(type: $type, first: $first, after: $after) {
          edges { cursor node {
            handle
            fieldsJson: field(key:"fields_json"){ value }
            img: field(key:"product_image_url"){ value }
            sav: field(key:"supplier_availability"){ value }
          } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `
    while (true) {
      const resp = await admin.graphql(GQL, { variables: { type: TYPE, first, after } })
      if (!resp.ok) break
      const jr = (await resp.json()) as {
        data?: {
          metaobjects?: {
            edges: Array<{
              cursor: string
              node: {
                handle?: string
                fieldsJson?: { value?: string | null } | null
                img?: { value?: string | null } | null
                sav?: { value?: string | null } | null
              }
            }>
            pageInfo: { hasNextPage: boolean; endCursor?: string | null }
          }
        }
      }
      const edges = jr?.data?.metaobjects?.edges || []
      for (const e of edges) {
        const handle = e?.node?.handle
        if (!handle) continue
        let hasPrice = false
        let hasPVC = false
        let hasImg = false
        let hasSav = false
        try {
          const raw = e?.node?.fieldsJson?.value
          const arr = raw ? JSON.parse(raw) : []
          if (Array.isArray(arr)) {
            hasPrice = arr.some((f: unknown) => {
              if (!f || typeof f !== 'object') return false
              const rec = f as { storage?: string; coreFieldPath?: string }
              return rec.storage === 'CORE' && rec.coreFieldPath === 'variants[0].price'
            })
            hasPVC = arr.some((f: unknown) => {
              if (!f || typeof f !== 'object') return false
              const rec = f as { storage?: string; coreFieldPath?: string }
              return rec.storage === 'CORE' && rec.coreFieldPath === 'variants[0].inventoryItem.cost'
            })
          }
        } catch {
          /* ignore */
        }
        hasImg = typeof e?.node?.img?.value === 'string' && e.node.img.value !== ''
        hasSav = typeof e?.node?.sav?.value === 'string' && e.node.sav.value !== ''
        out.push({
          id: handle,
          hasPrice,
          hasPrimaryVariantCost: hasPVC,
          hasProductImageUrl: hasImg,
          hasSupplierAvailability: hasSav,
        })
      }
      const pi = jr?.data?.metaobjects?.pageInfo
      if (pi?.hasNextPage && pi?.endCursor) after = pi.endCursor
      else break
    }
    return json(out)
  }
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
  return json({ error: 'Missing or invalid kind' }, { status: 400 })
}

export default function TemplatesApi() {
  return null
}
