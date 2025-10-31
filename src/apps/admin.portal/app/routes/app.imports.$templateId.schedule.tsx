// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@remix-run/react'
import { ImportState, type ScheduleConfig } from '../state/importerMachine'

export default function ImportSchedulePage() {
  const { templateId: tplParam } = useParams()
  const templateId = tplParam || 'DEMO-TEMPLATE'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [state, setState] = useState<ImportState>(ImportState.NEEDS_SETTINGS)
  // client-side preview only
  const [form, setForm] = useState<ScheduleConfig>({ enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/importer/schedule?templateId=${encodeURIComponent(templateId)}`)
        if (res.ok) {
          const jr = (await res.json()) as { state?: string; schedule?: ScheduleConfig }
          const st = (jr.state || ImportState.NEEDS_SETTINGS) as ImportState
          const sch = jr.schedule || { enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined }
          setState(st)
          setForm({ enabled: !!sch.enabled, freq: sch.freq || 'none', at: sch.at || '09:00', nextRunAt: sch.nextRunAt })
          // no-op
        }
      } catch {
        // ignore
      }
      setLoading(false)
    })()
  }, [templateId])

  const nextPreview = useMemo(() => {
    const compute = (nowIso: string, cfg: ScheduleConfig): string | undefined => {
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
    return compute(new Date().toISOString(), form) || undefined
  }, [form])

  const canEnable = state === ImportState.APPROVED || state === ImportState.SCHEDULED

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    if (form.enabled && !canEnable) {
      setBanner('Schedule available after approval.')
      return
    }
    setSaving(true)
    try {
      // Save schedule via API; server will handle state transitions
      const resp = await fetch('/api/importer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, enabled: form.enabled, freq: form.freq, at: form.at }),
      })
      if (!resp.ok) setBanner('Failed to save schedule')
      // Redirect back to imports home
      window.location.assign('/app/imports')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">Schedule</h1>
      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <form onSubmit={onSave} className="space-y-4">
          {banner ? <div className="rounded bg-amber-100 p-2 text-sm text-amber-800">{banner}</div> : null}
          <div className="flex items-center gap-2">
            <input
              id="enabled"
              type="checkbox"
              checked={!!form.enabled}
              onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              disabled={!canEnable && !form.enabled}
            />
            <label htmlFor="enabled" className="select-none">
              Enabled
            </label>
            {!canEnable && !form.enabled ? (
              <span className="ml-2 text-xs text-slate-500">Available after approval</span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              <span className="mb-1">Frequency</span>
              <select
                value={form.freq}
                onChange={e => setForm(f => ({ ...f, freq: e.target.value as ScheduleConfig['freq'] }))}
                className="rounded border px-2 py-1"
              >
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
              </select>
            </label>

            <label className="flex flex-col text-sm">
              <span className="mb-1">Time</span>
              <input
                type="time"
                value={form.at || '09:00'}
                onChange={e => setForm(f => ({ ...f, at: e.target.value }))}
                className="rounded border px-2 py-1"
              />
            </label>
          </div>

          <div className="text-sm text-slate-600">
            Next run:{' '}
            {form.enabled ? (nextPreview ? new Date(nextPreview).toLocaleString?.() || nextPreview : '—') : '—'}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded border px-3 py-1.5">
              Save
            </button>
            <a href="/app/imports" className="rounded border px-3 py-1.5">
              Cancel
            </a>
          </div>
        </form>
      )}
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
