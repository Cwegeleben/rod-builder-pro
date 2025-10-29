// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { importerActions, ImportState } from '../../state/importerMachine'

export default function ApproveAbortControls({
  templateId,
  runId,
  state,
}: {
  templateId: string
  runId?: string
  state: ImportState
}) {
  void runId // placeholder until UI displays RunId
  const canApprove = state === ImportState.READY_TO_APPROVE
  const canAbort =
    state === ImportState.READY_TO_APPROVE || state === ImportState.APPROVED || state === ImportState.IN_TEST
  return (
    <div className="flex gap-2">
      <button
        disabled={!canApprove}
        onClick={() => importerActions.approveRun(templateId)}
        className="rounded border px-2 py-1"
      >
        Approve
      </button>
      <button
        disabled={!canAbort}
        onClick={() => importerActions.deleteResetRun(templateId)}
        className="rounded border px-2 py-1"
      >
        Delete/Reset
      </button>
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
