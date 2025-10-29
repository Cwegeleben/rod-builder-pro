// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import ImportList from '../components/importer/ImportList'
import GlobalLogList from '../components/importer/GlobalLogList'

export default function ImportsHome() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Imports</h1>
        <a href="/app/imports/new">Add Import</a>
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
