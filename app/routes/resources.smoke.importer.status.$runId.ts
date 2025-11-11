import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { guardSmokeRoute } from '../lib/smokes.server'
import { prisma } from '../db.server'

// GET: /resources/smoke/importer/status/:runId
// Returns: { runId, status, templateId, progress, counts, preflight, publishProgress, startedAt, finishedAt, productDb }
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Enforce smoke token + enabled flags; this route intentionally skips HQ auth for CI-style checks
  guardSmokeRoute({ request } as LoaderFunctionArgs)

  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })
  const run = await prisma.importRun.findUnique({ where: { id: runId } })
  if (!run) return json({ error: 'Not found' }, { status: 404 })
  const supplierId = String(run.supplierId || '')

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

  // Handle TEXT storage: parse JSON if summary/progress are strings
  const rawSummary = typeof run.summary === 'string' ? safeParse(run.summary) : (run.summary as unknown)
  const summary =
    (rawSummary as {
      counts?: Record<string, number>
      preflight?: unknown
      publishProgress?: { processed?: number; target?: number; startedAt?: string; updatedAt?: string } | null
    }) || {}

  // Normalize progress shape
  const rawProgress =
    typeof (run as unknown as { progress?: unknown }).progress === 'string'
      ? safeParse((run as unknown as { progress?: unknown }).progress as string)
      : (run as unknown as { progress?: unknown }).progress
  let progress =
    (rawProgress as { phase?: string; percent?: number; etaSeconds?: number; details?: unknown } | null) || null
  if (!progress) {
    try {
      const counts = summary.counts || {}
      const expected = ((summary.preflight as unknown as { expectedItems?: number })?.expectedItems as number) || 0
      const staged = (counts.add || 0) + (counts.change || 0) + (counts.delete || 0)
      const pct = expected > 0 ? Math.max(5, Math.min(95, Math.round((staged / expected) * 100))) : undefined
      progress = { phase: run.status, percent: pct }
    } catch {
      /* ignore */
    }
  }

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

  // Optional product_db counts
  let productDb: { products?: number; versions?: number } | null = null
  try {
    const productTable = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Product'",
    )
    if (productTable.length) {
      const products = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
        `SELECT COUNT(1) AS c FROM Product p JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
        supplierId,
      )
      const versions = await prisma.$queryRawUnsafe<Array<{ c: unknown }>>(
        `SELECT COUNT(1) AS c FROM ProductVersion v JOIN Product p ON p.id = v.productId JOIN Supplier s ON s.id = p.supplierId WHERE s.slug = ?`,
        supplierId,
      )
      const toNum = (v: unknown) => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : Number(v) || 0)
      productDb = { products: toNum(products?.[0]?.c), versions: toNum(versions?.[0]?.c) }
    }
  } catch {
    /* ignore */
  }

  return json({
    runId: run.id,
    status: run.status,
    templateId,
    progress,
    counts: summary.counts || {},
    preflight: summary.preflight || null,
    publishProgress,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
    productDb,
  })
}

// No default export to keep this as a pure resource route that returns JSON
function safeParse(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}
