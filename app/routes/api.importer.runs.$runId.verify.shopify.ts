// Verify Shopify products exist for a run's approved diffs and backfill publish diagnostics (webUrl/status)
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import Shopify from 'shopify-api-node'
import { prisma } from '../db.server'
import { getShopAccessToken } from '../services/shopifyAdmin.server'
import { requireHqShopOr404 } from '../lib/access.server'
import { authenticate } from '../shopify.server'
import type { Prisma } from '@prisma/client'

function slugify(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}
function buildHandle(supplierId: string, externalId: string) {
  return `rbp-${slugify(supplierId)}-${slugify(externalId)}`
}
function mkProductUrl(shop: string, handle: string): string | null {
  if (!shop || !handle) return null
  const domain = shop.replace(/^https?:\/\//, '')
  return `https://${domain}/products/${handle}`
}

async function getShopDomainFromRequest(request: Request): Promise<string | null> {
  // Prefer the installed shop from the current admin session
  try {
    const { session } = await authenticate.admin(request)
    const s = (session as unknown as { shop?: string }).shop
    if (s) return s
  } catch {
    // ignore
  }
  // Fallback to env override or first offline session
  let shopDomain = process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
  if (!shopDomain) {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    if (sess?.shop) shopDomain = sess.shop
  }
  return shopDomain || null
}

async function verifyRun(runId: string, shopDomain: string) {
  if (!shopDomain) return { ok: false as const, error: 'No shop domain configured' }
  const accessToken = await getShopAccessToken(shopDomain)
  const shopify = new Shopify({ shopName: shopDomain, accessToken, apiVersion: '2024-10' })

  // Load diffs (approved first, fallback to all) with external context
  let diffs = await prisma.importDiff.findMany({
    where: { importRunId: runId, resolution: 'approve' },
    select: { id: true, after: true, validation: true, externalId: true },
  })
  if (!diffs.length) {
    diffs = await prisma.importDiff.findMany({
      where: { importRunId: runId },
      select: { id: true, after: true, validation: true, externalId: true },
    })
  }

  // Fetch run to obtain canonical supplierId for this run (used to build alternate handle)
  let runSupplierId: string | null = null
  try {
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    runSupplierId = (run?.supplierId && String(run.supplierId)) || null
  } catch {
    runSupplierId = null
  }

  let found = 0
  let notFound = 0
  let specMissing = 0

  // Helper: GraphQL productByHandle for precise lookup (REST list doesn't filter by handle)
  async function productByHandle(handle: string): Promise<any | null> {
    const query = `query($handle: String!){ productByHandle(handle: $handle){ id handle status } }`
    try {
      const res: any = await (shopify as any).graphql(query, { handle })
      return res?.productByHandle || null
    } catch {
      // Fallback: attempt REST list then filter locally if GraphQL fails
      try {
        const list: any[] = await (shopify as any).product.list({ limit: 50 })
        return list.find(p => p?.handle === handle) || null
      } catch {
        return null
      }
    }
  }

  async function readMetafields(productId: number): Promise<Array<any>> {
    try {
      return await (shopify as any).metafield.list({
        metafield: { owner_resource: 'product', owner_id: productId },
        limit: 250,
      })
    } catch {
      return []
    }
  }

  // GraphQL search by tag to reliably find all products from this run
  async function productsByTag(tag: string): Promise<Map<string, { id: number; status: string | null }>> {
    const map = new Map<string, { id: number; status: string | null }>()
    const query = `query($q: String!, $first: Int!, $after: String){
      products(first: $first, after: $after, query: $q){
        edges{ cursor node{ id handle status } }
        pageInfo{ hasNextPage }
      }
    }`
    let after: string | null = null
    const q = `tag:'${tag.replace(/'/g, "\\'")}'`
    // Paginate up to a safe cap
    for (let i = 0; i < 10; i++) {
      const vars: any = { q, first: 50, after }
      let res: any
      try {
        res = await (shopify as any).graphql(query, vars)
      } catch {
        break
      }
      const edges = Array.isArray(res?.products?.edges) ? res.products.edges : []
      for (const e of edges) {
        const node = e && e.node ? e.node : null
        if (node && node.handle && node.id) {
          const pidNum = Number(String(node.id).replace(/gid:\/\/shopify\/Product\//, ''))
          map.set(String(node.handle), { id: pidNum, status: (node as any).status || null })
        }
      }
      const hasNext = Boolean(res?.products?.pageInfo?.hasNextPage)
      if (!hasNext || edges.length === 0) break
      const lastCursor = edges[edges.length - 1]?.cursor
      after = lastCursor ? String(lastCursor) : null
      if (!after) break
    }
    return map
  }

  // Build a cache of products from this run by tag
  const byTag = await productsByTag(`importRun:${runId}`)

  for (const d of diffs) {
    const after: any = d.after || {}
    const supplierIdAfter = String(after?.supplierId || '')
    const externalId = String(after?.externalId || d.externalId || '')
    if (!externalId) continue
    // Build candidate handles from both the diff's supplierId and the run's supplierId
    const cands = new Set<string>()
    if (supplierIdAfter) cands.add(buildHandle(supplierIdAfter, externalId))
    if (runSupplierId) cands.add(buildHandle(String(runSupplierId), externalId))
    // Always attempt a generic 'batson' fallback as last resort
    cands.add(buildHandle('batson', externalId))
    try {
      let product: any | null = null
      let resolvedHandle: string | null = null
      // Try candidates via byTag map first
      for (const h of cands) {
        const hit = byTag.get(h)
        if (hit) {
          product = { id: hit.id, status: hit.status }
          resolvedHandle = h
          break
        }
      }
      // Fallback to productByHandle
      if (!product) {
        for (const h of cands) {
          const p = await productByHandle(h)
          if (p) {
            product = p
            resolvedHandle = h
            break
          }
        }
      }
      // Final fallback: scan byTag products and match rbp.supplier_external_id
      if (!product && byTag.size > 0) {
        for (const [h, meta] of byTag.entries()) {
          const pid = Number(meta.id)
          const mfs = await readMetafields(pid)
          const supExt = (mfs.find(m => m.namespace === 'rbp' && m.key === 'supplier_external_id')?.value || '')
            .toString()
            .toLowerCase()
          if (supExt && supExt === externalId.toLowerCase()) {
            product = { id: pid, status: meta.status }
            resolvedHandle = h
            break
          }
        }
      }
      const handle = resolvedHandle || Array.from(cands)[0]
      const existingPublish: any = (d.validation as any)?.publish || {}
      const skipReason: string | undefined = existingPublish?.skipReason
      const publishDiag: any = {
        at: new Date().toISOString(),
        handle,
        productId: null as number | null,
        status: null as string | null,
        webUrl: mkProductUrl(shopDomain, handle),
      }
      if (product) {
        found++
        const pidNum =
          typeof product.id === 'number'
            ? product.id
            : Number(String(product.id).replace(/gid:\/\/shopify\/Product\//, ''))
        publishDiag.productId = pidNum
        publishDiag.status = product.status || null
        // If this diff was previously classified as a series/category header, treat specs as OK and don't count missing keys
        const isSeriesHeader = Boolean(skipReason && /^series-header-/.test(skipReason))
        if (isSeriesHeader) {
          publishDiag.specOk = true
          publishDiag.specHeader = true
        } else {
          // Check presence of spec metafields only for real products
          const metafields = await readMetafields(pidNum)
          const specKeys = new Set(metafields.filter(m => m.namespace === 'rbp_spec').map(m => m.key))
          const required = ['series', 'length_in', 'pieces']
          let missing = required.filter(k => !specKeys.has(k))
          if (missing.length) {
            // Fallback: if discrete keys are missing, accept presence in rbp.specs JSON
            try {
              const specsMf = metafields.find(m => m.namespace === 'rbp' && m.key === 'specs')
              if (specsMf && typeof specsMf.value === 'string') {
                const specs = JSON.parse(specsMf.value)
                const covered = new Set<string>()
                for (const k of required) {
                  const v = (specs as any)?.[k]
                  if (v != null && String(v).trim().length > 0) covered.add(k)
                }
                missing = required.filter(k => !covered.has(k) && !specKeys.has(k))
              }
            } catch {
              /* ignore */
            }
          }
          if (missing.length) {
            specMissing++
            publishDiag.specMissingKeys = missing
          } else {
            publishDiag.specOk = true
          }
        }
      } else {
        notFound++
      }
      await prisma.importDiff.update({
        where: { id: d.id },
        data: {
          validation: {
            ...(d.validation as any),
            publish: {
              ...((d.validation as any)?.publish || {}),
              ...publishDiag,
            },
          } as any,
        },
      })
    } catch {
      // ignore individual diff errors
    }
  }
  return { ok: true as const, found, notFound, specMissing }
}

async function writeVerifySummary(runId: string, shop: string | null, found: number, notFound: number) {
  try {
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return
    const summary = (run.summary as unknown as Record<string, unknown>) || {}
    ;(summary as any).verify = { at: new Date().toISOString(), shop, found, notFound }
    await prisma.importRun.update({
      where: { id: runId },
      data: { summary: summary as unknown as Prisma.InputJsonValue },
    })
  } catch {
    // ignore
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = params.runId as string
  if (!runId) throw new Response('Missing runId', { status: 400 })
  const shop = await getShopDomainFromRequest(request)
  const res = shop ? await verifyRun(runId, shop) : { ok: false as const, error: 'No shop domain configured' }
  if ((res as any).ok && shop) await writeVerifySummary(runId, shop, (res as any).found, (res as any).notFound)
  return json(res)
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = params.runId as string
  if (!runId) return json({ ok: false, error: 'Missing runId' }, { status: 400 })
  const shop = await getShopDomainFromRequest(request)
  const res = shop ? await verifyRun(runId, shop) : { ok: false as const, error: 'No shop domain configured' }
  if ((res as any).ok && shop) await writeVerifySummary(runId, shop, (res as any).found, (res as any).notFound)
  return json(res)
}
