// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useState } from 'react'
import ImportRowStateBadge from './ImportRowStateBadge'
import ShopifyFilterLink from './ShopifyFilterLink'
import { importerActions, importerAdapters, ImportState } from '../../state/importerMachine'

type Row = {
  templateId: string
  name?: string
  state: ImportState
  runId?: string
  nextRunAt?: string
  hadFailures?: boolean
}

// NOTE: For Logic Pass 1 we simulate a single row pulled from adapters
export default function ImportList() {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const tpl = 'DEMO-TEMPLATE'
      const [cfg, sched] = await Promise.all([importerAdapters.getImportConfig(tpl), importerAdapters.getSchedule(tpl)])
      setRows([
        {
          templateId: tpl,
          name: 'Demo Import',
          state: cfg.state,
          runId: cfg.runId,
          nextRunAt: sched.nextRunAt,
          hadFailures: (cfg as { hadFailures?: boolean }).hadFailures,
        },
      ])
    })()
  }, [])

  async function doTest(r: Row) {
    setBusy(r.templateId)
    try {
      await importerActions.testRun(r.templateId)
    } finally {
      setBusy(null)
    }
    const [cfg, sched] = await Promise.all([
      importerAdapters.getImportConfig(r.templateId),
      importerAdapters.getSchedule(r.templateId),
    ])
    setRows(cur =>
      cur.map(x =>
        x.templateId === r.templateId ? { ...x, state: cfg.state, runId: cfg.runId, nextRunAt: sched.nextRunAt } : x,
      ),
    )
  }
  async function doApprove(r: Row) {
    if (!confirm('Publish all drafts for this run?')) return
    setBusy(r.templateId)
    try {
      await importerActions.approveRun(r.templateId)
    } finally {
      setBusy(null)
    }
    const [cfg, sched] = await Promise.all([
      importerAdapters.getImportConfig(r.templateId),
      importerAdapters.getSchedule(r.templateId),
    ])
    setRows(cur =>
      cur.map(x => (x.templateId === r.templateId ? { ...x, state: cfg.state, nextRunAt: sched.nextRunAt } : x)),
    )
  }
  async function doReset(r: Row) {
    if (!confirm('Delete drafts and reset this import?')) return
    setBusy(r.templateId)
    try {
      await importerActions.deleteResetRun(r.templateId)
    } finally {
      setBusy(null)
    }
    const [cfg, sched] = await Promise.all([
      importerAdapters.getImportConfig(r.templateId),
      importerAdapters.getSchedule(r.templateId),
    ])
    setRows(cur =>
      cur.map(x =>
        x.templateId === r.templateId ? { ...x, state: cfg.state, runId: cfg.runId, nextRunAt: sched.nextRunAt } : x,
      ),
    )
  }

  async function doRunNow(r: Row) {
    setBusy(r.templateId)
    try {
      await importerActions.recrawlRunNow(r.templateId)
    } finally {
      setBusy(null)
    }
    const [cfg, sched] = await Promise.all([
      importerAdapters.getImportConfig(r.templateId),
      importerAdapters.getSchedule(r.templateId),
    ])
    setRows(cur =>
      cur.map(x =>
        x.templateId === r.templateId
          ? {
              ...x,
              state: cfg.state,
              hadFailures: (cfg as { hadFailures?: boolean }).hadFailures,
              nextRunAt: sched.nextRunAt,
            }
          : x,
      ),
    )
  }

  return (
    <div className="space-y-2">
      {rows.map(r => {
        const isBusy = busy === r.templateId
        return (
          <div key={r.templateId} className="flex items-center gap-3 rounded border p-2">
            <div className="grow">
              <div className="font-medium">{r.name || r.templateId}</div>
              <ImportRowStateBadge />
            </div>
            {/* Actions per state matrix */}
            {r.state === ImportState.NEEDS_SETTINGS && (
              <button disabled className="rounded border px-2 py-1 opacity-60">
                Test
              </button>
            )}
            {r.state === ImportState.READY_TO_TEST && (
              <button disabled={isBusy} onClick={() => doTest(r)} className="rounded border px-2 py-1">
                Test
              </button>
            )}
            {r.state === ImportState.READY_TO_APPROVE && (
              <>
                {r.runId ? <ShopifyFilterLink runId={r.runId} /> : null}
                <button disabled={isBusy} onClick={() => doApprove(r)} className="rounded border px-2 py-1">
                  Approve
                </button>
                <button disabled={isBusy} onClick={() => doReset(r)} className="rounded border px-2 py-1">
                  Delete/Reset
                </button>
              </>
            )}
            {r.state === ImportState.APPROVED && (
              <>
                <a href={`/app/imports/${r.templateId}/schedule`} className="rounded border px-2 py-1">
                  Schedule
                </a>
                <button disabled={isBusy} onClick={() => doRunNow(r)} className="rounded border px-2 py-1">
                  Run Now
                </button>
                <button disabled={isBusy} onClick={() => doReset(r)} className="rounded border px-2 py-1">
                  Delete/Reset
                </button>
                {r.hadFailures ? (
                  <span className="ml-2 text-amber-700" title="Last run had failures">
                    ⚠︎
                  </span>
                ) : null}
              </>
            )}
            {r.state === ImportState.SCHEDULED && (
              <>
                <a href={`/app/imports/${r.templateId}/schedule`} className="rounded border px-2 py-1">
                  Schedule
                </a>
                <button disabled={isBusy} onClick={() => doRunNow(r)} className="rounded border px-2 py-1">
                  Run Now
                </button>
                <div className="text-xs text-slate-600">
                  Next run: {r.nextRunAt ? new Date(r.nextRunAt).toLocaleString?.() || r.nextRunAt : '—'}
                </div>
                {r.hadFailures ? (
                  <span className="ml-2 text-amber-700" title="Last run had failures">
                    ⚠︎
                  </span>
                ) : null}
              </>
            )}
            {r.state !== ImportState.APPROVED && r.state !== ImportState.SCHEDULED && (
              <button disabled className="rounded border px-2 py-1 opacity-60">
                Schedule
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
