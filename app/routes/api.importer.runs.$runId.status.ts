import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import { smokesEnabled, extractSmokeToken } from '../lib/smokes.server'

// Return a lightweight status snapshot for polling.
// GET: /api/importer/runs/:runId/status
// { status, counts, preflight, startedAt, finishedAt, progress, publishProgress }
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Allow smoke-token access when smokes are enabled; otherwise require HQ shop
    let bypassHq = false
    try {
      if (smokesEnabled()) {
        const tok = extractSmokeToken(request)
        const expected = process.env.SMOKE_TOKEN || 'smoke-ok'
        bypassHq = !!tok && tok === expected
      }
    } catch {
      bypassHq = false
    }
    if (!bypassHq) await requireHqShopOr404(request)

    const runId = String(params.runId || '')
    if (!runId) return json({ error: 'Missing run id' }, { status: 400 })

    let run: Awaited<ReturnType<typeof prisma.importRun.findUnique>> | null = null
    try {
      run = await prisma.importRun.findUnique({ where: { id: runId } })
    } catch (e) {
      return json({ error: 'Run lookup failed', message: (e as Error)?.message || String(e) }, { status: 500 })
    }
    if (!run) return json({ error: 'Not found' }, { status: 404 })

    const supplierId = String((run as unknown as { supplierId?: string }).supplierId || '')
    // Best-effort map run -> templateId
    let templateId: string | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tpl = await (prisma as any).importTemplate.findFirst({
        where: { preparingRunId: runId },
        select: { id: true },
      })
      templateId = tpl?.id || null
    } catch {
      /* ignore */
    }

    const summary =
      (run.summary as unknown as {
        counts?: Record<string, number>
        preflight?: unknown
        publishProgress?: { processed?: number; target?: number; startedAt?: string; updatedAt?: string } | null
      }) || {}

    // Derive simple percent if progress missing: approximate using staged vs expectedItems if available
    let progress =
      ((run as unknown as { progress?: unknown }).progress as {
        phase?: string
        percent?: number
        etaSeconds?: number
        details?: unknown
      } | null) || null
    if (!progress) {
      try {
        const counts = summary.counts || {}
        const expected = ((summary.preflight as unknown as { expectedItems?: number })?.expectedItems as number) || 0
        const staged = (counts.add || 0) + (counts.change || 0) + (counts.delete || 0)
        const pct = expected > 0 ? Math.max(5, Math.min(95, Math.round((staged / expected) * 100))) : undefined
        progress = { phase: (run as unknown as { status?: string }).status, percent: pct }
      } catch {
        /* ignore */
      }
    }

    // Extract publish progress if available
    const publishProgress = (() => {
      try {
        const pp = (
          summary as unknown as {
            publishProgress?: { processed?: number; target?: number; startedAt?: string; updatedAt?: string }
          }
        ).publishProgress
        if (!pp || typeof pp !== 'object') return null
        const processed = typeof pp.processed === 'number' ? pp.processed : 0
        const target = typeof pp.target === 'number' ? pp.target : 0
        const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((processed / target) * 100))) : undefined
        return { ...pp, percent: pct }
      } catch {
        return null
      }
    })()

    // Optional product_db counts for quick parity verification when canonical tables exist.
    let productDb: { products?: number; versions?: number } | null = null
    try {
      const productTable = await prisma.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Product'",
      )
      const supplierTable = await prisma.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Supplier'",
      )
      const versionTable = await prisma.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ProductVersion'",
      )
      const asNumber = (v: unknown): number => {
        if (typeof v === 'bigint') return Number(v)
        if (typeof v === 'number') return v
        const n = Number(v as number)
        return Number.isFinite(n) ? n : 0
      }
      if (productTable.length && supplierTable.length && versionTable.length && supplierId) {
        const products = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
          `SELECT COUNT(1) AS c FROM Product p JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
          supplierId,
        )
        const versions = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
          `SELECT COUNT(1) AS c FROM ProductVersion v JOIN Product p ON p.id = v.productId JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
          supplierId,
        )
        productDb = { products: asNumber(products?.[0]?.c), versions: asNumber(versions?.[0]?.c) }
      }
    } catch {
      /* ignore optional productDb errors */
    }

    return json({
      runId: (run as unknown as { id: string }).id,
      status: (run as unknown as { status?: string }).status,
      templateId,
      progress,
      counts: summary.counts || {},
      preflight: summary.preflight || null,
      publishProgress,
      startedAt: (run as unknown as { startedAt?: Date }).startedAt,
      finishedAt: (run as unknown as { finishedAt?: Date | null }).finishedAt || null,
      productDb,
    })
  } catch (e) {
    const message = (e as Error)?.message || 'Unexpected status error'
    return json({ error: 'status-loader-failed', message }, { status: 500 })
  }
}

export default function ImportRunStatusApi() {
  return null
}
