// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import ImportList from '../components/importer/ImportList'
import GlobalLogList from '../components/importer/GlobalLogList'
import { useEffect, useState } from 'react'

export default function ImportsHome() {
  // Preserve Shopify embedded query params (embedded, host, hmac, etc.)
  const [search, setSearch] = useState('')
  useEffect(() => {
    try {
      setSearch(window.location.search || '')
    } catch {
      // ignore SSR
    }
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Imports</h1>
        <a href={`/app/imports/new${search}`}>Add Import</a>
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
