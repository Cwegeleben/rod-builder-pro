import { useState, useMemo } from 'react'
import { Badge, BlockStack, Box, Button, InlineStack, Modal, Text } from '@shopify/polaris'

export type RunLog = { id: string; type: string; at: string; payload?: unknown }

function typeBadge(t: string) {
  switch (t) {
    case 'launcher:start':
      return <Badge tone="info">launcher:start</Badge>
    case 'launcher:success':
      return <Badge tone="success">launcher:success</Badge>
    case 'prepare:start':
      return <Badge tone="info">prep:start</Badge>
    case 'prepare:report':
      return <Badge tone="attention">prep:report</Badge>
    case 'prepare:done':
      return <Badge tone="success">prep:done</Badge>
    case 'prepare:error':
      return <Badge tone="critical">prep:error</Badge>
    case 'publish:start':
      return <Badge tone="info">publish:start</Badge>
    case 'publish:progress':
      return <Badge>publish:progress</Badge>
    case 'publish:done':
      return <Badge tone="success">publish:done</Badge>
    case 'publish:error':
      return <Badge tone="critical">publish:error</Badge>
    default:
      return <Badge>{t}</Badge>
  }
}

function payloadSnippet(payload: unknown): string | null {
  try {
    if (payload == null) return null
    const str = JSON.stringify(payload)
    // keep it compact
    return str.length > 160 ? str.slice(0, 157) + '…' : str
  } catch {
    return null
  }
}

export default function RunLogList({ logs = [] }: { logs?: RunLog[] }) {
  const [active, setActive] = useState<RunLog | null>(null)
  const [filter, setFilter] = useState<string>('ALL')
  const types = useMemo(() => {
    const set = new Set<string>()
    for (const l of logs) set.add(l.type)
    return Array.from(set).sort()
  }, [logs])
  const filtered = useMemo(() => {
    if (filter === 'ALL') return logs
    return logs.filter(l => l.type === filter)
  }, [filter, logs])
  if (!logs.length) {
    return (
      <Text as="p" tone="subdued">
        No activity yet.
      </Text>
    )
  }
  return (
    <>
      <InlineStack gap="200" wrap>
        <Button size="slim" variant={filter === 'ALL' ? 'primary' : undefined} onClick={() => setFilter('ALL')}>
          {`All (${logs.length})`}
        </Button>
        {types.map(t => {
          const count = logs.filter(l => l.type === t).length
          return (
            <Button key={t} size="slim" variant={filter === t ? 'primary' : undefined} onClick={() => setFilter(t)}>
              {`${t} (${count})`}
            </Button>
          )
        })}
      </InlineStack>
      <BlockStack gap="200">
        {filtered.map(l => (
          <Box key={l.id} padding="200" borderWidth="025" borderColor="border" borderRadius="100">
            <InlineStack align="space-between">
              <InlineStack gap="200" align="start">
                {typeBadge(l.type)}
                <Text as="span" tone="subdued">
                  {new Date(l.at).toLocaleString?.() || l.at}
                </Text>
              </InlineStack>
              <InlineStack gap="200" align="center">
                {(() => {
                  const snip = payloadSnippet(l.payload)
                  return snip ? (
                    <Text as="span" tone="subdued" variant="bodySm">
                      {snip}
                    </Text>
                  ) : null
                })()}
                <Button onClick={() => setActive(l)}>Details</Button>
              </InlineStack>
            </InlineStack>
          </Box>
        ))}
      </BlockStack>
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `${active.type} — ${new Date(active.at).toLocaleString?.() || active.at}` : 'Log details'}
        primaryAction={{ content: 'Close', onAction: () => setActive(null) }}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" tone="subdued">
              Full payload
            </Text>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
                {active ? JSON.stringify(active.payload ?? null, null, 2) : ''}
              </pre>
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  )
}
