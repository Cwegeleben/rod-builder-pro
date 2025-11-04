// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import { Card, BlockStack, Text, InlineStack, Badge, Button, Link as PolarisLink } from '@shopify/polaris'
import { useEffect } from 'react'
import { useFetcher } from '@remix-run/react'

export default function RowExpandPanel({
  runId,
  rowId,
  onApprove,
  onReject,
}: {
  runId: string
  rowId: string
  onApprove?: () => void
  onReject?: () => void
}) {
  const fetcher = useFetcher()
  useEffect(() => {
    if (rowId) fetcher.load(`/api/importer/runs/${runId}/staged/${rowId}`)
  }, [rowId, runId])
  const data = (fetcher.data || {}) as {
    changedFields?: Array<{
      key: string
      before?: unknown
      after?: unknown
      confidence?: number
      class: 'add' | 'update' | 'conflict'
    }>
    sourceUrl?: string | null
    images?: string[]
    attributesSubset?: Record<string, unknown>
    priceWh?: number | null
    priceMsrp?: number | null
    availability?: string | null
  }
  const fields = data.changedFields || []
  return (
    <Card>
      <BlockStack gap="200">
        <BlockStack gap="100">
          <Text as="h3" variant="headingSm">
            Changes
          </Text>
          {fields.length === 0 ? (
            <Text as="p" tone="subdued">
              No field changes.
            </Text>
          ) : (
            fields.map((f, idx) => (
              <InlineStack key={idx} align="space-between">
                <Text as="span">{f.key}</Text>
                <Text as="span" tone="subdued">
                  {String(f.before ?? '—')} → {String(f.after ?? '—')}
                </Text>
                <Badge tone={f.class === 'conflict' ? 'critical' : f.class === 'add' ? 'success' : 'attention'}>
                  {f.class}
                </Badge>
              </InlineStack>
            ))
          )}
        </BlockStack>
        <BlockStack gap="100">
          <Text as="h3" variant="headingSm">
            Metadata
          </Text>
          {data.sourceUrl ? (
            <PolarisLink url={data.sourceUrl} target="_blank">
              Source
            </PolarisLink>
          ) : null}
          <InlineStack gap="400">
            {data.priceWh != null ? (
              <Text as="span">Wholesale: ${data.priceWh?.toFixed?.(2) ?? String(data.priceWh)}</Text>
            ) : null}
            {data.priceMsrp != null ? (
              <Text as="span">MSRP: ${data.priceMsrp?.toFixed?.(2) ?? String(data.priceMsrp)}</Text>
            ) : null}
            {data.availability ? <Text as="span">Availability: {data.availability}</Text> : null}
          </InlineStack>
          {Array.isArray(data.images) && data.images.length ? (
            <InlineStack gap="200">
              {data.images.slice(0, 8).map((src, i) => (
                <img key={i} src={src} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
              ))}
            </InlineStack>
          ) : null}
        </BlockStack>
        <BlockStack gap="100">
          <Text as="h3" variant="headingSm">
            Attributes
          </Text>
          {data.attributesSubset && Object.keys(data.attributesSubset).length ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              {Object.entries(data.attributesSubset).map(([k, v]) => (
                <>
                  <Text as="span" tone="subdued">
                    {k}
                  </Text>
                  <Text as="span">{formatVal(v)}</Text>
                </>
              ))}
            </div>
          ) : (
            <Text as="p" tone="subdued">
              No attributes available.
            </Text>
          )}
        </BlockStack>
        <InlineStack gap="200">
          {onApprove ? <Button onClick={onApprove}>Approve</Button> : null}
          {onReject ? (
            <Button tone="critical" onClick={onReject}>
              Reject
            </Button>
          ) : null}
        </InlineStack>
      </BlockStack>
    </Card>
  )
}

function formatVal(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return '—'
  }
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
