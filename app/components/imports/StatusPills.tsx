// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { Badge } from '@shopify/polaris'

type Tone = 'success' | 'critical' | 'attention' | 'info'

export function StatusPill({ status, unresolvedAdds }: { status: string; unresolvedAdds?: number }) {
  let tone: Tone = 'info'
  if (status === 'failed') tone = 'critical'
  else if (status === 'started') tone = 'attention'
  else if (unresolvedAdds && unresolvedAdds > 0) tone = 'attention'
  else if (status === 'success') tone = 'success'
  const label = unresolvedAdds && unresolvedAdds > 0 ? 'needs review' : status
  return <Badge tone={tone}>{label}</Badge>
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
