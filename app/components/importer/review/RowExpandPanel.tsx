// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import { Card, BlockStack, Text, InlineStack, Badge, Button } from '@shopify/polaris'
import { useEffect, Fragment } from 'react'
import { useFetcher } from '@remix-run/react'

export default function RowExpandPanel({
  runId,
  rowId,
  onApprove,
  onReject,
  detailsBase,
}: {
  runId: string
  rowId: string
  onApprove?: () => void
  onReject?: () => void
  // Optional alternate endpoint builder for smoke mode; default uses API route
  detailsBase?: (runId: string, rowId: string) => string
}) {
  const fetcher = useFetcher()
  useEffect(() => {
    if (rowId) {
      const url = detailsBase ? detailsBase(runId, rowId) : `/api/importer/runs/${runId}/preview/${rowId}`
      fetcher.load(url)
    }
  }, [rowId, runId, detailsBase])
  const data = (fetcher.data || {}) as {
    preview?: {
      core: { title: string; body_html: string; vendor: string; product_type: string; handle: string; tags: string }
      variant: {
        sku: string
        price?: string
        compare_at_price?: string
        grams?: number
        taxable: boolean
        inventory_policy: 'deny'
        inventory_management: null
      }
      metafields: Array<{ namespace: string; key: string; type: string; value: string }>
      images: string[]
    }
    valid?: boolean
    errors?: string[]
    publish?: {
      at?: string
      action?: string
      productId?: number
      handle?: string
      error?: string
      status?: number
      detail?: unknown
    }
  }
  const preview = data.preview
  return (
    <Card>
      <BlockStack gap="200">
        {data.valid === false ? (
          <BlockStack gap="100">
            <Text as="p" tone="critical">
              Cannot publish: {data.errors?.join(', ')}
            </Text>
          </BlockStack>
        ) : null}
        {data.publish?.error ? (
          <BlockStack gap="050">
            <Text as="p" tone="critical">
              Last publish error: {data.publish.error}
            </Text>
            {data.publish.detail ? (
              <Text as="p" tone="subdued">
                {formatVal(data.publish.detail as unknown as string)}
              </Text>
            ) : null}
          </BlockStack>
        ) : null}
        {preview ? (
          <>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Core
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 8 }}>
                <Text as="span" tone="subdued">
                  Title
                </Text>
                <Text as="span">{preview.core.title}</Text>
                <Text as="span" tone="subdued">
                  Vendor
                </Text>
                <Text as="span">{preview.core.vendor}</Text>
                <Text as="span" tone="subdued">
                  Type
                </Text>
                <Text as="span">{preview.core.product_type}</Text>
                <Text as="span" tone="subdued">
                  Handle
                </Text>
                <Text as="span">{preview.core.handle}</Text>
                <Text as="span" tone="subdued">
                  Tags
                </Text>
                <Text as="span">{preview.core.tags}</Text>
              </div>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Variant
              </Text>
              <InlineStack gap="400">
                <Badge>{`SKU: ${preview.variant.sku}`}</Badge>
                {preview.variant.price ? <Badge tone="success">{`Price: $${preview.variant.price}`}</Badge> : null}
                {preview.variant.compare_at_price ? (
                  <Badge tone="warning">{`Compare at: $${preview.variant.compare_at_price}`}</Badge>
                ) : null}
                {preview.variant.grams != null ? <Badge>{`Weight: ${preview.variant.grams}g`}</Badge> : null}
              </InlineStack>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Attributes (metafields)
              </Text>
              {preview.metafields && preview.metafields.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                  <Text as="span" tone="subdued">
                    Namespace
                  </Text>
                  <Text as="span" tone="subdued">
                    Key
                  </Text>
                  <Text as="span" tone="subdued">
                    Value
                  </Text>
                  {preview.metafields.map(mf => (
                    <Fragment key={`${mf.namespace}.${mf.key}`}>
                      <Text as="span">{mf.namespace}</Text>
                      <InlineStack gap="200">
                        <Text as="span">{mf.key}</Text>
                        <Badge>{mf.type}</Badge>
                      </InlineStack>
                      <Text as="span">{formatVal(prettyVal(mf))}</Text>
                    </Fragment>
                  ))}
                </div>
              ) : (
                <Text as="p" tone="subdued">
                  No attributes.
                </Text>
              )}
            </BlockStack>
            {Array.isArray(preview.images) && preview.images.length ? (
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">
                  Images
                </Text>
                <InlineStack gap="200">
                  {preview.images.slice(0, 8).map(src => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                    />
                  ))}
                </InlineStack>
              </BlockStack>
            ) : null}
          </>
        ) : (
          <Text as="p" tone="subdued">
            Loading preview…
          </Text>
        )}
        <BlockStack gap="100">
          <InlineStack gap="200">
            {onApprove ? <Button onClick={onApprove}>Approve</Button> : null}
            {onReject ? (
              <Button tone="critical" onClick={onReject}>
                Reject
              </Button>
            ) : null}
          </InlineStack>
        </BlockStack>
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

function prettyVal(mf: { type: string; value: string }): unknown {
  if (mf.type === 'json') {
    try {
      return JSON.parse(mf.value)
    } catch {
      return mf.value
    }
  }
  if (mf.type?.startsWith('list.')) {
    try {
      const arr = JSON.parse(mf.value)
      return Array.isArray(arr) ? arr : mf.value
    } catch {
      return mf.value
    }
  }
  return mf.value
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
