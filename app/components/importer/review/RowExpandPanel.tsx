// <!-- BEGIN RBP GENERATED: importer-review-inline-v2 -->
import { Card, BlockStack, Text, InlineStack, Badge, Button, DescriptionList, Collapsible } from '@shopify/polaris'
import { useEffect, Fragment, useMemo, useState } from 'react'
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
  const [showAttrs, setShowAttrs] = useState(false)
  const [showImages, setShowImages] = useState(false)

  const coreItems = useMemo(
    () =>
      preview
        ? [
            { term: 'Title', description: preview.core.title },
            { term: 'Vendor', description: preview.core.vendor },
            { term: 'Type', description: preview.core.product_type },
            {
              term: 'Handle',
              description: (
                <InlineStack gap="200">
                  <Text as="span">{preview.core.handle}</Text>
                  <Button onClick={() => copyToClipboard(preview.core.handle)} accessibilityLabel="Copy handle">
                    Copy
                  </Button>
                </InlineStack>
              ),
            },
            { term: 'Tags', description: preview.core.tags },
          ]
        : [],
    [preview],
  )

  const variantItems = useMemo(
    () =>
      preview
        ? [
            {
              term: 'SKU',
              description: (
                <InlineStack gap="200">
                  <Text as="span">{preview.variant.sku}</Text>
                  <Button onClick={() => copyToClipboard(preview.variant.sku)} accessibilityLabel="Copy SKU">
                    Copy
                  </Button>
                </InlineStack>
              ),
            },
            ...(preview.variant.price ? [{ term: 'Price', description: `$${preview.variant.price}` }] : []),
            ...(preview.variant.compare_at_price
              ? [{ term: 'Compare at', description: `$${preview.variant.compare_at_price}` }]
              : []),
            ...(preview.variant.grams != null ? [{ term: 'Weight', description: `${preview.variant.grams} g` }] : []),
          ]
        : [],
    [preview],
  )

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
              <DescriptionList items={coreItems} />
            </BlockStack>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Variant
              </Text>
              <DescriptionList items={variantItems} />
            </BlockStack>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Attributes (metafields)
              </Text>
              {preview.metafields && preview.metafields.length ? (
                <BlockStack gap="100">
                  <InlineStack gap="200">
                    <Button onClick={() => setShowAttrs(s => !s)}>
                      {`${showAttrs ? 'Hide' : 'Show'} ${preview.metafields.length} attributes`}
                    </Button>
                  </InlineStack>
                  <Collapsible
                    open={showAttrs}
                    id={`attrs-${rowId}`}
                    transition={{ duration: '200ms', timingFunction: 'ease' }}
                  >
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
                  </Collapsible>
                </BlockStack>
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
                  <Button onClick={() => setShowImages(s => !s)}>
                    {`${showImages ? 'Hide' : 'Show'} ${preview.images.length} images`}
                  </Button>
                </InlineStack>
                <Collapsible
                  open={showImages}
                  id={`imgs-${rowId}`}
                  transition={{ duration: '200ms', timingFunction: 'ease' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 48px)', gap: 8 }}>
                    {preview.images.slice(0, 24).map(src => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ))}
                  </div>
                </Collapsible>
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

function copyToClipboard(text: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // ignore
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  } catch {
    // no-op
  }
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
