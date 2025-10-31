// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { Text, Badge, InlineStack } from '@shopify/polaris'

type LogRow = {
  at: string
  templateId: string
  runId: string
  type: 'discovery' | 'scrape' | 'drafts' | 'approve' | 'abort' | 'schedule' | 'recrawl' | 'error'
  payload?: unknown
}

export default function GlobalLogList({ items = [] }: { items?: LogRow[] }) {
  const badge = (t: LogRow['type']) => {
    switch (t) {
      case 'discovery':
        return <Badge tone="info">discovery</Badge>
      case 'scrape':
        return <Badge tone="attention">scrape</Badge>
      case 'drafts':
        return <Badge>drafts</Badge>
      case 'approve':
        return <Badge tone="success">approve</Badge>
      case 'abort':
        return <Badge tone="critical">abort</Badge>
      case 'schedule':
        return <Badge tone="info">schedule</Badge>
      case 'recrawl':
        return <Badge tone="attention">recrawl</Badge>
      case 'error':
        return <Badge tone="critical">error</Badge>
    }
  }
  if (!items.length) {
    return (
      <Text as="p" tone="subdued">
        No logs yet.
      </Text>
    )
  }
  return (
    <div>
      {items.map((r, i) => {
        let nextRunSnippet: string | null = null
        const p = r.payload as unknown
        if (r.type === 'schedule' && p && typeof p === 'object' && 'nextRunAt' in (p as Record<string, unknown>)) {
          const nr = (p as Record<string, unknown>).nextRunAt
          if (typeof nr === 'string' && nr) nextRunSnippet = new Date(nr).toLocaleString?.() || nr
        }
        return (
          <InlineStack key={i} gap="200" align="start">
            {badge(r.type)}
            <Text as="span" tone="subdued">
              {new Date(r.at).toLocaleString?.() || r.at}
            </Text>
            <Text as="span">template</Text>
            <a href={`#tpl-${r.templateId}`}>{r.templateId}</a>
            <Text as="span" tone="subdued">
              run
            </Text>
            <Text as="span">{r.runId}</Text>
            {nextRunSnippet ? (
              <Text as="span" tone="subdued">
                next: {nextRunSnippet}
              </Text>
            ) : null}
            {(() => {
              if (r.type !== 'recrawl') return null
              const payload = r.payload as { failed?: unknown[] } | undefined
              const failCount = Array.isArray(payload?.failed) ? payload!.failed!.length : 0
              return failCount > 0 ? (
                <Text as="span" tone="critical">
                  fails: {failCount}
                </Text>
              ) : null
            })()}
          </InlineStack>
        )
      })}
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
