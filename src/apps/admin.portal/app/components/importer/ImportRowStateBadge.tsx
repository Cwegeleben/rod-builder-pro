// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { ImportState } from '../../state/importerMachine'
import { Badge, InlineStack, Text } from '@shopify/polaris'

type Extra = {
  preparingPct?: number
  preparingPhase?: string
  publishingPct?: number
  failed?: boolean
  queued?: boolean
}

export default function ImportRowStateBadge({
  state = ImportState.NEEDS_SETTINGS,
  extra,
}: {
  state?: ImportState
  extra?: Extra
}) {
  const phaseLabel = (() => {
    if (extra?.failed) return 'Failed'
    if (typeof extra?.publishingPct === 'number') return 'Publishing'
    if (typeof extra?.preparingPct === 'number') return extra.preparingPhase ? extra.preparingPhase : 'Preparing'
    return null
  })()
  const pctLabel = (() => {
    const pct = typeof extra?.publishingPct === 'number' ? extra.publishingPct : extra?.preparingPct
    if (typeof pct === 'number') return `${Math.max(0, Math.min(100, Math.round(pct)))}%`
    return null
  })()
  const badge = (() => {
    switch (state) {
      case ImportState.NEEDS_SETTINGS:
        return <Badge tone="info">Needs settings</Badge>
      case ImportState.READY:
        return <Badge tone="info">Ready</Badge>
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
  })()
  if (!phaseLabel && !pctLabel && !extra?.queued && !extra?.failed) return badge
  return (
    <InlineStack gap="150" blockAlign="center">
      {badge}
      {extra?.queued ? <Badge tone="info">Queued</Badge> : null}
      {extra?.failed ? <Badge tone="critical">Failed</Badge> : null}
      {phaseLabel ? (
        <Text as="span" tone="subdued">
          {phaseLabel}
        </Text>
      ) : null}
      {pctLabel ? <Badge tone="attention">{pctLabel}</Badge> : null}
    </InlineStack>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
