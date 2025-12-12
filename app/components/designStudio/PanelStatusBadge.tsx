import { Badge } from '@shopify/polaris'
import type { DesignStudioValidationSeverity } from '../../lib/designStudio/validation'
import { memo } from 'react'

const LABELS: Record<DesignStudioValidationSeverity, string> = {
  error: 'Needs attention',
  warning: 'Check fit',
  info: 'Heads up',
}

const TONES: Record<DesignStudioValidationSeverity, 'critical' | 'warning' | 'info'> = {
  error: 'critical',
  warning: 'warning',
  info: 'info',
}

export type PanelStatusBadgeProps = {
  severity: DesignStudioValidationSeverity
  count: number
  testId?: string
}

export const PanelStatusBadge = memo(function PanelStatusBadge({ severity, count, testId }: PanelStatusBadgeProps) {
  if (!count || count <= 0) return null
  const label = LABELS[severity]
  const suffix = count > 1 ? ` (${count})` : ''
  const content = `${label}${suffix}`
  return (
    <span data-testid={testId} className="ml-1 inline-flex">
      <Badge tone={TONES[severity]}>{content}</Badge>
    </span>
  )
})
