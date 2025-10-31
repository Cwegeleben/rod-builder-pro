// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

type ScheduleCfg = {
  enabled?: boolean
  freq?: 'daily' | 'weekly' | 'monthly' | 'none'
  at?: string
  nextRunAt?: string
}

function computeNextRun(
  nowIso: string,
  cfg: Required<Pick<ScheduleCfg, 'enabled' | 'freq'>> & ScheduleCfg,
): string | undefined {
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
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const templateId = String(url.searchParams.get('templateId') || '').trim()
  if (!templateId) return json({ error: 'Missing templateId' }, { status: 400 })
  const { prisma } = await import('../db.server')
  const row = await (prisma as any).importTemplate.findUnique({
    where: { id: templateId },
    select: { state: true, importConfig: true },
  })
  if (!row) return json({ error: 'Not found' }, { status: 404 })
  const cfg = row.importConfig && typeof row.importConfig === 'object' ? (row.importConfig as any) : {}
  const sch = cfg.schedule && typeof cfg.schedule === 'object' ? (cfg.schedule as ScheduleCfg) : {}
  return json({
    state: row.state as string,
    schedule: { enabled: !!sch.enabled, freq: sch.freq || 'none', at: sch.at || '09:00', nextRunAt: sch.nextRunAt },
  })
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const ct = request.headers.get('content-type') || ''
  const read = async () => {
    if (/application\/json/i.test(ct)) return (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fd = await request.formData().catch(() => null)
    const o: Record<string, unknown> = {}
    if (fd) {
      const id = String(fd.get('templateId') || '').trim()
      if (id) o.templateId = id
      const enabled = fd.get('enabled')
      if (enabled != null) o.enabled = String(enabled) === 'true' || enabled === 'on'
      const freq = String(fd.get('freq') || '').trim()
      if (freq) o.freq = freq
      const at = String(fd.get('at') || '').trim()
      if (at) o.at = at
    }
    return o
  }
  const body = (await read()) as { templateId?: string } & ScheduleCfg
  const templateId = body.templateId?.trim() || ''
  if (!templateId) return json({ error: 'Missing templateId' }, { status: 400 })
  const { prisma } = await import('../db.server')
  try {
    const row = await (prisma as any).importTemplate.findUnique({ where: { id: templateId } })
    if (!row) return json({ error: 'Not found' }, { status: 404 })
    const cfg = row.importConfig && typeof row.importConfig === 'object' ? (row.importConfig as any) : {}
    const current: ScheduleCfg = cfg.schedule && typeof cfg.schedule === 'object' ? (cfg.schedule as ScheduleCfg) : {}
    const merged: Required<Pick<ScheduleCfg, 'enabled' | 'freq'>> & ScheduleCfg = {
      enabled: body.enabled ?? !!current.enabled,
      freq: (body.freq as any) ?? (current.freq || 'none'),
      at: body.at ?? current.at ?? '09:00',
      nextRunAt: current.nextRunAt,
    }
    if (merged.enabled) merged.nextRunAt = computeNextRun(new Date().toISOString(), merged)
    else merged.nextRunAt = undefined
    const nextCfg = { ...cfg, schedule: merged }
    // State transition: enable -> SCHEDULED (only if APPROVED/SCHEDULED), disable -> APPROVED
    let nextState = row.state as string
    if (merged.enabled) {
      if (row.state === 'APPROVED' || row.state === 'SCHEDULED') nextState = 'SCHEDULED'
      else {
        // Not eligible: force disable
        merged.enabled = false
        merged.nextRunAt = undefined
      }
    } else {
      if (row.state === 'SCHEDULED') nextState = 'APPROVED'
    }
    await (prisma as any).importTemplate.update({
      where: { id: templateId },
      data: { importConfig: nextCfg, state: nextState },
    })
    await (prisma as any).importLog.create({
      data: {
        templateId,
        runId: `schedule-${Date.now()}`,
        type: 'SCHEDULE_UPDATE',
        payload: { enabled: merged.enabled, freq: merged.freq, at: merged.at, nextRunAt: merged.nextRunAt },
      },
    })
    return json({ ok: true, state: nextState, schedule: merged })
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Schedule update failed' }, { status: 400 })
  }
}

export default function ScheduleApi() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3 -->
