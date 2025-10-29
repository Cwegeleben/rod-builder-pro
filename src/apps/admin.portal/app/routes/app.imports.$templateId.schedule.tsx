// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@remix-run/react'
import { importerAdapters, importerActions, ImportState, type ScheduleConfig } from '../state/importerMachine'

export default function ImportSchedulePage() {
  const { templateId: tplParam } = useParams()
  const templateId = tplParam || 'DEMO-TEMPLATE'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [state, setState] = useState<ImportState>(ImportState.NEEDS_SETTINGS)
  const [origEnabled, setOrigEnabled] = useState(false)
  const [form, setForm] = useState<ScheduleConfig>({ enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined })

  useEffect(() => {
    ;(async () => {
      const [cfg, sched] = await Promise.all([
        importerAdapters.getImportConfig(templateId),
        importerAdapters.getSchedule(templateId),
      ])
      setState(cfg.state)
      setForm({
        enabled: !!sched.enabled,
        freq: sched.freq || 'none',
        at: sched.at || '09:00',
        nextRunAt: sched.nextRunAt,
      })
      setOrigEnabled(!!sched.enabled)
      setLoading(false)
    })()
  }, [templateId])

  const nextPreview = useMemo(
    () => importerAdapters.computeNextRun(new Date().toISOString(), form) || undefined,
    [form],
  )

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
      // Save freq/at first, then toggle enable to drive state transition
      await importerActions.updateSchedule(templateId, { freq: form.freq, at: form.at })
      if (form.enabled !== origEnabled) {
        await importerActions.setScheduleEnabled(templateId, form.enabled)
      } else {
        // If still enabled, recompute nextRunAt preview save
        if (form.enabled) await importerActions.updateSchedule(templateId, { nextRunAt: nextPreview })
      }
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
