// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
type LogRow = {
  at: string
  templateId: string
  runId: string
  type: 'discovery' | 'scrape' | 'drafts' | 'approve' | 'abort' | 'schedule' | 'error'
  payload?: unknown
}

export default function GlobalLogList({ items = [] }: { items?: LogRow[] }) {
  const badge = (t: LogRow['type']) => {
    const base = 'inline-block px-2 py-0.5 text-xs rounded'
    switch (t) {
      case 'discovery':
        return <span className={`${base} bg-blue-100 text-blue-700`}>discovery</span>
      case 'scrape':
        return <span className={`${base} bg-amber-100 text-amber-700`}>scrape</span>
      case 'drafts':
        return <span className={`${base} bg-slate-100 text-slate-700`}>drafts</span>
      case 'approve':
        return <span className={`${base} bg-green-100 text-green-700`}>approve</span>
      case 'abort':
        return <span className={`${base} bg-red-100 text-red-700`}>abort</span>
      case 'schedule':
        return <span className={`${base} bg-purple-100 text-purple-700`}>schedule</span>
      case 'error':
        return <span className={`${base} bg-rose-200 text-rose-800`}>error</span>
    }
  }
  return (
    <div className="rounded border">
      <div className="border-b px-3 py-2 font-medium">Logs</div>
      {!items.length ? (
        <div className="px-3 py-2 text-sm text-slate-500">No logs yet.</div>
      ) : (
        <ul className="divide-y">
          {items.map((r, i) => {
            let nextRunSnippet: string | null = null
            const p = r.payload as unknown
            if (r.type === 'schedule' && p && typeof p === 'object' && 'nextRunAt' in (p as Record<string, unknown>)) {
              const nr = (p as Record<string, unknown>).nextRunAt
              if (typeof nr === 'string' && nr) nextRunSnippet = new Date(nr).toLocaleString?.() || nr
            }
            return (
              <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                {badge(r.type)}
                <span className="text-slate-500">{new Date(r.at).toLocaleString?.() || r.at}</span>
                <span>template</span>
                <a href={`#tpl-${r.templateId}`} className="underline">
                  {r.templateId}
                </a>
                <span className="text-slate-500">run</span>
                <span>{r.runId}</span>
                {nextRunSnippet ? <span className="ml-2 text-slate-600">next: {nextRunSnippet}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
