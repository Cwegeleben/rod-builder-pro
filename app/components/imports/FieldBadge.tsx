// <!-- BEGIN RBP GENERATED: importer-extractor-templates-v2 -->
import { Badge, Tooltip } from '@shopify/polaris'

export type FieldStatus = 'ok' | 'fallback' | 'missing'
export type FieldSource = 'jsonld' | 'dom' | 'slug' | 'hash' | 'unknown'

type Tone = 'success' | 'critical' | 'attention' | 'info'

export function FieldBadge({ source, status }: { source: FieldSource; status: FieldStatus }) {
  const tone: Tone = status === 'ok' ? 'success' : status === 'missing' ? 'critical' : 'attention'
  const label = `${source}`
  return (
    <Tooltip content={`source: ${source}, status: ${status}`}>
      <Badge tone={tone}>{label}</Badge>
    </Tooltip>
  )
}
// <!-- END RBP GENERATED: importer-extractor-templates-v2 -->
