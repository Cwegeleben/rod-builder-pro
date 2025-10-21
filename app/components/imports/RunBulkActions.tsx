// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { Button, ButtonGroup } from '@shopify/polaris'
import type { ReactNode } from 'react'

export function RunBulkActions({
  onApproveAdds,
  onRerun,
  onEnable,
  onDisable,
  extra,
  disabled,
}: {
  onApproveAdds?: () => void
  onRerun?: () => void
  onEnable?: () => void
  onDisable?: () => void
  extra?: ReactNode
  disabled?: boolean
}) {
  return (
    <ButtonGroup>
      <Button onClick={onApproveAdds} disabled={disabled}>
        Approve Adds
      </Button>
      <Button onClick={onRerun} disabled={disabled}>
        Re-run
      </Button>
      <Button onClick={onEnable} disabled={disabled}>
        Enable
      </Button>
      <Button onClick={onDisable} disabled={disabled}>
        Disable
      </Button>
      {extra}
    </ButtonGroup>
  )
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
