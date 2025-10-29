// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import ImportList from '../components/importer/ImportList'
import GlobalLogList from '../components/importer/GlobalLogList'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from '@remix-run/react'

type ImportsHomeProps = { search?: string }

export default function ImportsHome(props: ImportsHomeProps = {}) {
  const location = useLocation()
  // Prefer SSR-provided prop (if passed), else use Remix location on first render
  const [qs, setQs] = useState<string>(props.search ?? location.search ?? '')

  // Hydration safety: if empty, fall back to window.location.search
  useEffect(() => {
    if (!qs && typeof window !== 'undefined') {
      setQs(window.location.search || '')
    }
  }, [])

  const addImportHref = useMemo(() => {
    const search = qs || ''
    return `/app/imports/new${search}`
  }, [qs])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Imports</h1>
        <Link to={addImportHref} className="rounded border px-3 py-1.5">
          Add Import
        </Link>
      </div>
      <section>
        <ImportList />
      </section>
      <section>
        <GlobalLogList />
      </section>
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
