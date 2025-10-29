// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { importerActions } from '../state/importerMachine'

export default function ImportSettings() {
  async function onSave() {
    // Placeholder: assume config changed and is valid
    await importerActions.suspendScheduleOnConfigChange('DEMO-TEMPLATE')
    await importerActions.markReadyToTest('DEMO-TEMPLATE')
    alert('Saved. State moved to READY_TO_TEST')
  }
  return (
    <div>
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
