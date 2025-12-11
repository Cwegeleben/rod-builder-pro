import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Card,
  EmptyState,
  Frame,
  InlineStack,
  Page,
  Tabs,
  Text,
  Toast,
} from '@shopify/polaris'
import { useEffect, useMemo, useState } from 'react'
import {
  getProductImportRunDetail,
  type ProductImportRunDetail,
  type ProductImportRunItemView,
} from '../models/productImportRun.server'
import { requireHqShopOr404 } from '../lib/access.server'
import { applyImportRun, type ApplyImportRunResult, type ApplyRunItemError } from '../services/imports/applyRun.server'
import type { ProductSnapshot } from '../domain/imports/diffTypes'

type LoaderData = { detail: ProductImportRunDetail }

type ApplyRunActionResponse = { ok: true; result: ApplyImportRunResult } | { ok: false; error: string }

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = params.runId
  if (!runId) throw new Response('Not Found', { status: 404 })
  const detail = await getProductImportRunDetail(runId)
  if (!detail) throw new Response('Not Found', { status: 404 })
  return json<LoaderData>({ detail })
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = params.runId
  if (!runId) throw new Response('Not Found', { status: 404 })
  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent !== 'apply-run')
    return json<ApplyRunActionResponse>({ ok: false, error: 'Unsupported intent' }, { status: 400 })
  try {
    const result = await applyImportRun(runId)
    return json<ApplyRunActionResponse>({ ok: true, result })
  } catch (error) {
    return json<ApplyRunActionResponse>(
      { ok: false, error: (error as Error).message || 'Failed to apply run' },
      { status: 400 },
    )
  }
}

export default function ImportRunDetailRoute() {
  const loaderData = useLoaderData<typeof loader>() as LoaderData
  const { detail } = loaderData
  const applyFetcher = useFetcher<ApplyRunActionResponse>()
  const [toast, setToast] = useState<string | null>(null)
  const tabs = useMemo(() => buildTabs(detail.itemsByKind), [detail.itemsByKind])
  const [selectedTab, setSelectedTab] = useState(() => initialTabIndex(tabs))
  const isApplying = applyFetcher.state !== 'idle'
  const alreadyApplied = detail.run.status?.startsWith('applied') ?? false
  const applyErrors: ApplyRunItemError[] = applyFetcher.data?.ok ? applyFetcher.data.result.errors : []

  useEffect(() => {
    if (applyFetcher.state === 'idle' && applyFetcher.data?.ok) {
      setToast('Run applied successfully')
    } else if (applyFetcher.state === 'idle' && applyFetcher.data && !applyFetcher.data.ok) {
      setToast(applyFetcher.data.error || 'Apply failed')
    }
  }, [applyFetcher.state, applyFetcher.data])

  useEffect(() => {
    setSelectedTab(prev => (tabs[prev] ? prev : initialTabIndex(tabs)))
  }, [tabs])

  const currentTab = tabs[selectedTab] || tabs[0]
  const currentItems = detail.itemsByKind[currentTab?.kind ?? 'add'] || []

  const applySummary = extractApplySummary(detail.run.summary)

  return (
    <Page
      title={`Run ${detail.run.id}`}
      backAction={{ content: 'Import runs', url: '/app/import-runs' }}
      primaryAction={{
        content: alreadyApplied ? 'Already applied' : 'Apply this run',
        disabled: alreadyApplied,
        loading: isApplying,
        onAction: () => {
          const formData = new FormData()
          formData.append('intent', 'apply-run')
          applyFetcher.submit(formData, { method: 'post' })
        },
      }}
    >
      <BlockStack gap="400">
        {toast ? (
          <Frame>
            <Toast content={toast} duration={3000} onDismiss={() => setToast(null)} />
          </Frame>
        ) : null}
        <Card>
          <Box padding="400">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    {detail.run.supplierSlug}
                  </Text>
                  <Text as="p" tone="subdued">
                    {formatDate(detail.run.startedAt)} → {formatDate(detail.run.finishedAt)}
                  </Text>
                </BlockStack>
                <Badge tone={statusTone(detail.run.status)}>{statusLabel(detail.run.status)}</Badge>
              </InlineStack>
              <InlineStack gap="200" wrap>
                <StatChip label="Adds" value={detail.run.totalAdds} tone="success" />
                <StatChip label="Changes" value={detail.run.totalChanges} tone="caution" />
                <StatChip label="Deletes" value={detail.run.totalDeletes} tone="critical" />
                <StatChip
                  label="Duration"
                  value={formatDuration(detail.run.startedAt, detail.run.finishedAt)}
                  tone="info"
                />
              </InlineStack>
              {applySummary ? (
                <Banner tone={applySummary.errors?.length ? 'warning' : 'success'} title="Last apply">
                  <Text as="p" tone="subdued">
                    Applied {formatDate(applySummary.appliedAt)} — Adds {applySummary.counts.addsApplied}/
                    {applySummary.counts.addsAttempted} | Changes {applySummary.counts.changesApplied}/
                    {applySummary.counts.changesAttempted} | Deletes {applySummary.counts.deletesApplied}/
                    {applySummary.counts.deletesAttempted}
                  </Text>
                </Banner>
              ) : null}
              {applyErrors && applyErrors.length ? (
                <Banner tone="warning" title="Applied with warnings">
                  <BlockStack gap="100">
                    {applyErrors.map(error => (
                      <Text key={error.productCode} as="p">
                        <strong>{error.productCode}:</strong> {error.message}
                      </Text>
                    ))}
                  </BlockStack>
                </Banner>
              ) : null}
            </BlockStack>
          </Box>
        </Card>
        <Card>
          <Tabs
            tabs={tabs.map(tab => ({ id: tab.id, content: `${tab.label} (${tab.count})`, panelID: `${tab.id}-panel` }))}
            selected={selectedTab}
            onSelect={index => setSelectedTab(index)}
          />
          <Box padding="400">
            {currentItems.length === 0 ? (
              <EmptyState
                heading="No items"
                image="https://cdn.shopify.com/b/shopify-brochure/assets/empty-states/empty-state.svg"
              >
                Nothing to review in this bucket.
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                {currentItems.map(item => (
                  <DiffItemCard key={item.id} item={item} />
                ))}
              </BlockStack>
            )}
          </Box>
        </Card>
      </BlockStack>
    </Page>
  )
}

type TabDefinition = { id: string; kind: 'add' | 'change' | 'delete'; label: string; count: number }

function buildTabs(groups: Record<'add' | 'change' | 'delete', ProductImportRunItemView[]>) {
  const config: TabDefinition[] = [
    { id: 'adds', kind: 'add', label: 'Adds', count: groups.add.length },
    { id: 'changes', kind: 'change', label: 'Changes', count: groups.change.length },
    { id: 'deletes', kind: 'delete', label: 'Deletes', count: groups.delete.length },
  ]
  return config
}

function initialTabIndex(tabs: TabDefinition[]): number {
  const firstWithRows = tabs.findIndex(tab => tab.count > 0)
  return firstWithRows >= 0 ? firstWithRows : 0
}

function DiffItemCard({ item }: { item: ProductImportRunItemView }) {
  const before = item.beforeSnapshot
  const after = item.afterSnapshot
  const badgeTone = item.kind === 'add' ? 'success' : item.kind === 'change' ? 'attention' : 'critical'
  const badgeLabel = item.kind === 'add' ? 'Add' : item.kind === 'change' ? 'Change' : 'Delete'
  return (
    <Box padding="300" borderRadius="200" borderWidth="025" borderColor="border">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text variant="headingSm" as="h3">
              {item.productCode}
            </Text>
            <Text as="p" tone="subdued">
              {item.category} {item.family ? `• ${item.family}` : ''}
            </Text>
          </BlockStack>
          <Badge tone={badgeTone}>{badgeLabel}</Badge>
        </InlineStack>
        {item.kind === 'change' ? <ChangedFieldsList fields={item.changedFields} /> : null}
        {item.kind === 'add' ? (
          <SnapshotSummary label="After snapshot" snapshot={after} />
        ) : item.kind === 'delete' ? (
          <SnapshotSummary label="Before snapshot" snapshot={before} />
        ) : (
          <InlineStack gap="200" wrap>
            <SnapshotSummary label="Before" snapshot={before} />
            <SnapshotSummary label="After" snapshot={after} />
          </InlineStack>
        )}
      </BlockStack>
    </Box>
  )
}

function ChangedFieldsList({ fields }: { fields: ProductImportRunItemView['changedFields'] }) {
  if (!fields.length)
    return (
      <Text as="p" tone="subdued">
        No field-level changes detected.
      </Text>
    )
  return (
    <BlockStack gap="100">
      {fields.map(field => (
        <Box key={`${field.field}-${String(field.before)}-${String(field.after)}`}>
          <Text as="p">
            <strong>{field.field}</strong>: {formatValue(field.before)} → {formatValue(field.after)}
          </Text>
        </Box>
      ))}
    </BlockStack>
  )
}

function SnapshotSummary({ label, snapshot }: { label: string; snapshot: ProductSnapshot | null }) {
  if (!snapshot)
    return (
      <Text as="p" tone="subdued">
        No snapshot available.
      </Text>
    )
  const attributes = Object.entries(snapshot.attributes || {})
  return (
    <Box maxWidth="360px">
      <BlockStack gap="100">
        <Text variant="headingSm" as="h4">
          {label}
        </Text>
        <Text as="p" tone="subdued">
          {snapshot.brand || '—'} {snapshot.series ? `• ${snapshot.series}` : ''}
        </Text>
        <InlineStack gap="200" wrap>
          <Meta label="MSRP" value={formatCurrency(snapshot.msrp)} />
          <Meta label="Availability" value={snapshot.availability || '—'} />
          <Meta label="Design ready" value={snapshot.designStudioReady ? 'Yes' : 'No'} />
        </InlineStack>
        {attributes.length ? (
          <details>
            <summary>Attributes ({attributes.length})</summary>
            <Box paddingBlockStart="100">
              <BlockStack gap="050">
                {attributes.slice(0, 5).map(([key, value]) => (
                  <Text as="p" key={key} tone="subdued">
                    {key}: {formatValue(value)}
                  </Text>
                ))}
                {attributes.length > 5 ? (
                  <Text as="span" tone="subdued">
                    …
                  </Text>
                ) : null}
              </BlockStack>
            </Box>
          </details>
        ) : null}
      </BlockStack>
    </Box>
  )
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'success' | 'caution' | 'critical' | 'info'
}) {
  return (
    <BlockStack gap="050" align="start">
      <Text as="span" tone="subdued">
        {label}
      </Text>
      <Text as="span" tone={tone === 'info' ? undefined : tone} variant="headingMd">
        {value}
      </Text>
    </BlockStack>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <BlockStack gap="025">
      <Text as="span" tone="subdued" fontWeight="medium">
        {label}
      </Text>
      <Text as="span">{value}</Text>
    </BlockStack>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatDuration(start: string, end: string | null | undefined) {
  if (!start || !end) return 'Pending'
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return '—'
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  return `${minutes}m ${rem}s`
}

function formatCurrency(value?: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function statusLabel(status?: string | null) {
  if (!status) return 'Unknown'
  if (status === 'diffed') return 'Ready for review'
  if (status === 'pending') return 'Pending'
  if (status === 'applied') return 'Applied'
  if (status === 'applied_with_warnings') return 'Applied (warnings)'
  if (status === 'failed') return 'Failed'
  return status
}

function statusTone(status?: string | null): 'success' | 'critical' | 'info' | 'attention' {
  if (status === 'applied') return 'success'
  if (status === 'applied_with_warnings') return 'attention'
  if (status === 'failed' || status === 'error') return 'critical'
  return 'info'
}

function extractApplySummary(summary: Record<string, unknown> | null | undefined): {
  appliedAt: string
  counts: ApplyImportRunResult['counts']
  errors?: ApplyImportRunResult['errors']
} | null {
  if (!summary || typeof summary !== 'object') return null
  const apply = (summary as Record<string, unknown>).apply as
    | { appliedAt?: string; counts?: ApplyImportRunResult['counts']; errors?: ApplyImportRunResult['errors'] }
    | undefined
  if (!apply || !apply.appliedAt || !apply.counts) return null
  return { appliedAt: apply.appliedAt, counts: apply.counts, errors: apply.errors }
}
