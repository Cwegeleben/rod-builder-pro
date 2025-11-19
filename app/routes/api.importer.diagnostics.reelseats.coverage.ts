import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'
import { requireHqShopOr404 } from '../lib/access.server'

type CovSampleMap = { url: string; productId: string; sku: string; title: string }
type CovTopGroup = { productId: string; sku: string; title: string; sources: number; sampleUrls: string[] }
type CovSkipSample = { url: string; reason: string; h1?: string; tokens?: string[] }

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireHqShopOr404(request)
    const url = new URL(request.url)
    const supplierSlug = url.searchParams.get('supplierId') || 'batson-reel-seats'
    const validate = url.searchParams.get('validate') === '1'
    const sinceParam = url.searchParams.get('since')
    const windowDays = (() => {
      const raw = url.searchParams.get('windowDays')
      const n = raw ? Number(raw) : 14
      return Number.isFinite(n) && n > 0 ? n : 14
    })()
    const limit = (() => {
      const raw = url.searchParams.get('limit')
      const n = raw ? Number(raw) : 100
      return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 100
    })()
    const runId = url.searchParams.get('runId') || undefined
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - windowDays * 24 * 3600 * 1000)
    const useRaw = url.searchParams.get('raw') === '1'
    const rawAll = url.searchParams.get('rawAll') === '1'

    let supplier: Awaited<ReturnType<typeof prisma.supplier.findFirst>> | null = null
    try {
      supplier = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
    } catch (e) {
      return json({ error: 'supplier-lookup-failed', message: (e as Error)?.message || String(e) }, { status: 500 })
    }
    if (!supplier) return json({ error: 'supplier-missing', supplierSlug }, { status: 404 })
    const supplierId = supplier.id

    // Seeds in window (be resilient to older DBs missing productId column)
    let seeds: Array<{ url: string; productId: string | null }> = []
    if (useRaw) {
      try {
        const rows = rawAll
          ? await prisma.$queryRawUnsafe<Array<{ url: string }>>(
              'SELECT url FROM ProductSource WHERE supplierId = ?1 ORDER BY lastSeenAt DESC',
              supplierId,
            )
          : await prisma.$queryRawUnsafe<Array<{ url: string }>>(
              'SELECT url FROM ProductSource WHERE supplierId = ?1 AND julianday(lastSeenAt) >= julianday(?2) ORDER BY lastSeenAt DESC',
              supplierId,
              since.toISOString(),
            )
        seeds = rows.map(r => ({ url: r.url, productId: null }))
      } catch {
        seeds = []
      }
    } else {
      try {
        // Prefer selecting only the fields we need
        const rows = await prisma.productSource.findMany({
          where: { supplierId, lastSeenAt: { gte: since } },
          orderBy: { lastSeenAt: 'desc' },
          select: { url: true, productId: true },
        })
        seeds = rows.map(r => ({
          url: r.url,
          productId: (rows as Array<{ url: string; productId?: string | null }>)[0]?.productId ?? null,
        }))
      } catch {
        // Fallback for DBs without productId column
        try {
          const rows = await prisma.productSource.findMany({
            where: { supplierId, lastSeenAt: { gte: since } },
            orderBy: { lastSeenAt: 'desc' },
            select: { url: true },
          })
          seeds = rows.map(r => ({ url: r.url, productId: null }))
        } catch {
          seeds = []
        }
      }
    }
    const mappedSeeds = seeds.filter(s => !!s.productId)
    const mappedCount = mappedSeeds.length

    // Consolidated groups by productId
    const byPid: Record<string, { urls: string[]; sku?: string; title?: string }> = {}
    for (const s of mappedSeeds) {
      const pid = s.productId as string
      if (!byPid[pid]) byPid[pid] = { urls: [] }
      byPid[pid].urls.push(s.url)
    }
    // Fill sku/title for top groups (best-effort)
    const topPids = Object.entries(byPid)
      .sort((a, b) => b[1].urls.length - a[1].urls.length)
      .slice(0, 50)
      .map(([pid]) => pid)
    if (topPids.length) {
      const prods = await prisma.product.findMany({ where: { id: { in: topPids } } })
      const mapP = new Map(prods.map(p => [p.id, p]))
      for (const pid of topPids) {
        const p = mapP.get(pid)
        if (p) {
          byPid[pid].sku = (p as { sku?: string }).sku || ''
          byPid[pid].title = (p as { title?: string }).title || ''
        }
      }
    }
    const consolidatedGroups: CovTopGroup[] = Object.entries(byPid)
      .filter(([, v]) => v.urls.length > 1)
      .slice(0, 50)
      .map(([pid, v]) => ({
        productId: pid,
        sku: v.sku || '',
        title: v.title || '',
        sources: v.urls.length,
        sampleUrls: v.urls.slice(0, 5),
      }))

    // Skip logs in window (accept both new and legacy types)
    const skipTypes = ['normalize:skip', 'manual:fetch:failed', 'manual:parse:empty']
    let logs: Array<{ payload: unknown; type: string }> = []
    try {
      logs = await prisma.importLog.findMany({
        where: { type: { in: skipTypes }, at: { gte: since }, ...(runId ? { runId } : {}) },
        orderBy: { at: 'desc' },
      })
    } catch {
      logs = []
    }
    const skipByUrl = new Map<string, CovSkipSample>()
    for (const L of logs) {
      const payload = L.payload as unknown as { url?: string; reasonCode?: string; h1?: string; tokens?: string[] }
      const u = payload?.url || ''
      if (!u) continue
      if (!skipByUrl.has(u)) {
        const reason =
          payload?.reasonCode ||
          (L.type === 'manual:parse:empty'
            ? 'parse-empty'
            : L.type === 'manual:fetch:failed'
              ? 'fetch-failed'
              : 'unknown')
        skipByUrl.set(u, { url: u, reason, h1: payload?.h1, tokens: payload?.tokens })
      }
    }

    // Classify dropped and unknown
    const droppedSamples: CovSkipSample[] = []
    const unknownSamples: { url: string }[] = []
    let droppedCount = 0
    let unknownCount = 0
    for (const s of seeds) {
      if (s.productId) continue
      const d = skipByUrl.get(s.url)
      if (d) {
        droppedCount++
        if (droppedSamples.length < limit) droppedSamples.push(d)
      } else {
        unknownCount++
        if (unknownSamples.length < limit) unknownSamples.push({ url: s.url })
      }
    }

    // Build mapped sample
    const mappedSample: CovSampleMap[] = []
    if (mappedSeeds.length) {
      try {
        const m = mappedSeeds.slice(0, limit)
        const pids = Array.from(new Set(m.map(s => s.productId as string)))
        const prods = await prisma.product.findMany({ where: { id: { in: pids } } })
        const mapP = new Map(prods.map(p => [p.id, p]))
        for (const s of m) {
          const p = mapP.get(s.productId as string)
          if (!p) continue
          mappedSample.push({
            url: s.url,
            productId: p.id,
            sku: (p as { sku?: string }).sku || '',
            title: (p as { title?: string }).title || '',
          })
        }
      } catch {
        /* ignore */
      }
    }

    // Optional validate probe (lightweight)
    let validateProbe:
      | Array<{ url: string; hasTitle: boolean; hasCart: boolean; inferredFamily?: string; inferredSize?: string }>
      | undefined
    if (validate) {
      const takeDropped = droppedSamples.slice(0, Math.min(10, droppedSamples.length))
      const takeUnknown = unknownSamples.slice(0, Math.min(10, unknownSamples.length))
      const probe = [...takeDropped.map(x => x.url), ...takeUnknown.map(x => x.url)]
      validateProbe = []
      for (const u of probe) {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 8000)
          const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
          clearTimeout(timer)
          const t = r.ok ? await r.text() : ''
          const hasTitle = /<h1[^>]*>[^<]{1,200}<\/h1>/i.test(t)
          const hasCart = /add-to-cart|AddToCartForm|form[^>]+action="[^"]*cart/i.test(t)
          const fam = (t.match(/(Dual\s+Trigger|AIP\s+Contour|Rapid\s+Spin|TX17|VTG)/i)?.[1] || '').trim() || undefined
          const size = (t.match(/\bSize\s*(\d{1,3})\b/i)?.[1] || '').trim() || undefined
          validateProbe.push({ url: u, hasTitle, hasCart, inferredFamily: fam, inferredSize: size })
        } catch {
          validateProbe.push({ url: u, hasTitle: false, hasCart: false })
        }
      }
    }

    const totals = {
      seeds: seeds.length,
      mapped: mappedCount,
      consolidated: consolidatedGroups.reduce((acc, g) => acc + g.sources, 0),
      dropped: droppedCount,
      unknown: unknownCount,
    }
    const meta = {
      supplierId: supplierSlug,
      window: { since: since.toISOString() },
      runId,
      raw: useRaw,
      rawAll,
      generatedAt: new Date().toISOString(),
    }

    return json({
      totals,
      mapped: { count: mappedCount, sample: mappedSample },
      consolidated: { count: consolidatedGroups.length, top: consolidatedGroups },
      dropped: {
        count: droppedCount,
        reasons: droppedSamples.reduce<Record<string, number>>((acc, d) => {
          acc[d.reason] = (acc[d.reason] || 0) + 1
          return acc
        }, {}),
        sample: droppedSamples,
      },
      unknown: { count: unknownCount, sample: unknownSamples },
      validate: validate ? validateProbe : undefined,
      meta,
    })
  } catch (e) {
    const message = (e as Error)?.message || 'coverage-loader-failed'
    return json({ error: 'coverage-failed', message }, { status: 500 })
  }
}

export default function ImporterReelSeatsCoverageDiagnostics() {
  return null
}
