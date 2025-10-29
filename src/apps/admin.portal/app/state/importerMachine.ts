// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
export enum ImportState {
  NEEDS_SETTINGS = 'NEEDS_SETTINGS',
  READY_TO_TEST = 'READY_TO_TEST',
  IN_TEST = 'IN_TEST',
  READY_TO_APPROVE = 'READY_TO_APPROVE',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  ABORTED = 'ABORTED',
  FAILED = 'FAILED',
}

export interface ImportRun {
  id: string
  templateId: string
  state: ImportState
  lastRunAt?: string
  nextRunAt?: string
  counts?: { added: number; updated: number; failed: number; skipped: number }
}

export const importerActions = {
  testRun: async (_templateId: string) => {
    void _templateId /* stub */
  },
  approveRun: async (_templateId: string) => {
    void _templateId /* stub */
  },
  deleteResetRun: async (_templateId: string) => {
    void _templateId /* stub */
  },
  suspendScheduleOnConfigChange: async (_templateId: string) => {
    void _templateId /* stub */
  },
}
// <!-- END RBP GENERATED: importer-v2-3 -->
