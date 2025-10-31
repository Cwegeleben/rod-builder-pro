// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { importerActions } from '../state/importerMachine'
import { useSearchParams } from '@remix-run/react'

export default function ImportSettings() {
  const [params] = useSearchParams()
  const justCreated = params.get('created') === '1'
  async function onSave() {
    // Placeholder: assume config changed and is valid
    await importerActions.suspendScheduleOnConfigChange('DEMO-TEMPLATE')
    await importerActions.markReadyToTest('DEMO-TEMPLATE')
    alert('Saved. State moved to READY_TO_TEST')
  }
  return (
    <div>
      {justCreated ? (
        <div className="mb-3 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
          Import created. You can configure settings below.
        </div>
      ) : null}
      <h1>Import Settings</h1>
      <div>importer-v2-3 placeholder: General</div>
      <div>importer-v2-3 placeholder: Scrape & Mapping</div>
      <div>importer-v2-3 placeholder: Preview</div>
      <div className="mt-3">
        <button onClick={onSave} className="rounded border px-3 py-1">
          Save Settings
        </button>
      </div>
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
