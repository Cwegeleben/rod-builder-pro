// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { ImportState } from '../../state/importerMachine'
import { Badge } from '@shopify/polaris'

export default function ImportRowStateBadge({ state = ImportState.NEEDS_SETTINGS }: { state?: ImportState }) {
  switch (state) {
    case ImportState.NEEDS_SETTINGS:
      return <Badge tone="info">Needs settings</Badge>
    case ImportState.READY_TO_TEST:
      return <Badge tone="attention">Validate</Badge>
    case ImportState.READY_TO_APPROVE:
      return <Badge tone="success">Validated</Badge>
    case ImportState.APPROVED:
      return <Badge tone="success">Approved</Badge>
    case ImportState.SCHEDULED:
      return <Badge tone="info">Scheduled</Badge>
    default:
      return <Badge>{String(state)}</Badge>
  }
}
// <!-- END RBP GENERATED: importer-v2-3 -->
