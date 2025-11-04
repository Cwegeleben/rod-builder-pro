/* eslint-disable @typescript-eslint/no-explicit-any */
import { json, type LoaderFunctionArgs } from '@remix-run/node'

// Scheduler endpoint to process due ImportTemplate schedules (template-level refresh-only runs).
// Auth: Prefer token via Authorization: Bearer <SCHEDULER_TOKEN>. Falls back to HQ guard when not provided.
// Behavior:
// - Scans ImportTemplate rows with schedule.enabled=true and nextRunAt <= now and state in APPROVED|SCHEDULED
// - Groups due templates by supplierId (derived from ImportTemplate.importConfig.settings.target via getTargetById)
// - For each supplierId, runs price/availability refresh job (packages/importer runPriceAvailabilityRefresh)
// - Updates nextRunAt for all due templates mapped to that supplier and writes ImportLog entries
// - Returns JSON summary { ok, suppliers: { total, succeeded, failed }, templatesUpdated }

function computeNextRun(
  nowIso: string,
  cfg: { enabled?: boolean; freq?: 'daily' | 'weekly' | 'monthly' | 'none'; at?: string },
) {
  if (!cfg.enabled) return undefined
  if (!cfg.freq || cfg.freq === 'none') return undefined
  const now = new Date(nowIso)
  if (Number.isNaN(now.getTime())) return undefined
  const [hh, mm] = (cfg.at || '09:00').split(':').map(v => parseInt(v, 10))
  const next = new Date(now)
  next.setSeconds(0, 0)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) next.setHours(9, 0, 0, 0)
  else next.setHours(hh, mm, 0, 0)
  if (next.getTime() <= now.getTime()) {
    if (cfg.freq === 'daily') next.setDate(next.getDate() + 1)
    else if (cfg.freq === 'weekly') next.setDate(next.getDate() + 7)
    else if (cfg.freq === 'monthly') next.setMonth(next.getMonth() + 1)
  }
  return next.toISOString()
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Allow POST or GET; treat both as trigger
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'POST') return json({ ok: false, error: 'Method Not Allowed' }, { status: 405 })

  // Optional token auth for external schedulers
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const allowToken = process.env.SCHEDULER_TOKEN && token === process.env.SCHEDULER_TOKEN
  if (!allowToken) {
    // Fallback to HQ guard when token not provided/mismatched
    const { requireHqShopOr404 } = await import('../lib/access.server')
    await requireHqShopOr404(request)
  }

  const nowIso = new Date().toISOString()
  const { prisma } = await import('../db.server')
  const { getTargetById } = await import('../server/importer/sites/targets')
  const { runPriceAvailabilityRefresh } = await import('../../packages/importer/src/jobs/priceAvail')

  // Load templates with an enabled schedule that is due now
  const rows = await (prisma as any).importTemplate.findMany({
    select: { id: true, name: true, state: true, importConfig: true, lastRunAt: true },
    where: { OR: [{ state: 'APPROVED' }, { state: 'SCHEDULED' }] },
  })

  type DueTpl = {
    id: string
    name?: string
    schedule: { enabled: boolean; freq: 'daily' | 'weekly' | 'monthly' | 'none'; at?: string; nextRunAt?: string }
    supplierId?: string
  }
  const due: DueTpl[] = []
  for (const r of rows as Array<{ id: string; name?: string; state: string; importConfig?: any }>) {
    try {
      const cfg = (r.importConfig || {}) as Record<string, unknown>
      const settings = (cfg['settings'] as Record<string, unknown>) || {}
      const schedule = (cfg['schedule'] as Record<string, unknown>) || {}
      const enabled = !!schedule['enabled']
      const freq = (schedule['freq'] as DueTpl['schedule']['freq']) || 'none'
      const at = typeof schedule['at'] === 'string' ? (schedule['at'] as string) : '09:00'
      const nextRunAt = typeof schedule['nextRunAt'] === 'string' ? (schedule['nextRunAt'] as string) : undefined
      if (!enabled || !nextRunAt) continue
      const nextTs = Date.parse(nextRunAt)
      if (!Number.isFinite(nextTs)) continue
      if (nextTs > Date.now()) continue // not due yet
      const targetId = typeof settings['target'] === 'string' ? (settings['target'] as string) : ''
      const target = targetId ? getTargetById(targetId) : undefined
      const supplierId = ((target?.siteId as string) || targetId || '').trim()
      due.push({ id: r.id, name: r.name, supplierId, schedule: { enabled, freq, at, nextRunAt } })
    } catch {
      // ignore malformed config
    }
  }

  if (!due.length) return json({ ok: true, suppliers: { total: 0, succeeded: 0, failed: 0 }, templatesUpdated: 0 })

  // Group by supplier to avoid duplicate refresh work per supplier
  const bySupplier = new Map<string, DueTpl[]>()
  for (const t of due) {
    const key = t.supplierId || '_unknown'
    if (!bySupplier.has(key)) bySupplier.set(key, [])
    bySupplier.get(key)!.push(t)
  }

  let succeeded = 0
  let failed = 0
  let templatesUpdated = 0

  for (const [supplierId, tplList] of bySupplier.entries()) {
    try {
      if (supplierId && supplierId !== '_unknown') {
        await runPriceAvailabilityRefresh(supplierId)
      }
      // Update schedules for all templates mapped to this supplier
      for (const t of tplList) {
        const nextRunAt = computeNextRun(nowIso, t.schedule)
        const cfg = (
          await (prisma as any).importTemplate.findUnique({ where: { id: t.id }, select: { importConfig: true } })
        )?.importConfig as any
        const nextCfg = { ...(cfg || {}), schedule: { ...t.schedule, nextRunAt } }
        await (prisma as any).importTemplate.update({
          where: { id: t.id },
          data: { importConfig: nextCfg, lastRunAt: new Date(nowIso) },
        })
        await (prisma as any).importLog.create({
          data: {
            templateId: t.id,
            runId: `schedule-${Date.now()}`,
            type: 'SCHEDULE_RUN',
            payload: { supplierId, nextRunAt },
          },
        })
        templatesUpdated++
      }
      succeeded++
    } catch (e) {
      failed++
      // Log failures for each template
      for (const t of tplList) {
        await (prisma as any).importLog.create({
          data: {
            templateId: t.id,
            runId: `schedule-${Date.now()}`,
            type: 'SCHEDULE_ERROR',
            payload: { supplierId, error: (e as Error)?.message || String(e) },
          },
        })
      }
    }
  }

  return json({
    ok: true,
    suppliers: { total: bySupplier.size, succeeded, failed },
    templatesUpdated,
    dueTemplates: due.map(d => ({ id: d.id, supplierId: d.supplierId, nextRunAt: d.schedule.nextRunAt })),
  })
}

export default function SchedulerImportsResource() {
  return null
}
