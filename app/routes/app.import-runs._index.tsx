import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, useLoaderData, useNavigation, useRevalidator, useSearchParams } from '@remix-run/react'
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Page,
  Select,
  Text,
} from '@shopify/polaris'
import { listProductImportRuns } from '../models/productImportRun.server'
import { useEffect, useMemo, useState } from 'react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  diffed: 'Ready for review',
  applied: 'Applied',
  failed: 'Failed',
  applied_with_warnings: 'Applied (warnings)',
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const supplierSlug = url.searchParams.get('supplier') || undefined
  const statusParam = url.searchParams.get('status') || undefined
  const runs = await listProductImportRuns({ supplierSlug, status: statusParam })
  return json({
    runs,
    filters: {
      supplier: supplierSlug || '',
      status: statusParam || '',
    },
  })
}

export default function ImportRunsIndexRoute() {
  const data = useLoaderData<typeof loader>()
  const [params] = useSearchParams()
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const busy = navigation.state !== 'idle'
  const [supplierFilter, setSupplierFilter] = useState(data.filters.supplier)
  const [statusFilter, setStatusFilter] = useState(data.filters.status)

  useEffect(() => {
    setSupplierFilter(data.filters.supplier)
    setStatusFilter(data.filters.status)
  }, [data.filters.supplier, data.filters.status])

  const supplierOptions = useMemo(
    () =>
      buildSupplierOptions(
        data.filters.supplier,
        data.runs.map(run => run.supplierSlug),
      ),
    [data.filters.supplier, data.runs],
  )

  const statusOptions = useMemo(
    () => [
      { label: 'All statuses', value: '' },
      ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
    ],
    [],
  )
  return (
    <Page title="Import runs" primaryAction={{ content: 'Refresh', onAction: () => revalidator.revalidate() }}>
      <BlockStack gap="400">
        <Card>
          <Box padding="400">
            <Form method="get">
              <InlineGrid columns={{ xs: 1, sm: '2fr 1fr auto' }} gap="200">
                <Select
                  label="Supplier"
                  value={supplierFilter}
                  onChange={value => setSupplierFilter(value)}
                  options={supplierOptions}
                />
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={value => setStatusFilter(value)}
                  options={statusOptions}
                />
                <InlineStack gap="200" align="end">
                  <Button submit variant="primary" loading={busy}>
                    Apply filters
                  </Button>
                  {(params.get('supplier') || params.get('status')) && (
                    <Button variant="tertiary" url="/app/import-runs">
                      Clear
                    </Button>
                  )}
                </InlineStack>
              </InlineGrid>
              <input type="hidden" name="supplier" value={supplierFilter} />
              <input type="hidden" name="status" value={statusFilter} />
            </Form>
          </Box>
        </Card>
        <Card>
          {data.runs.length === 0 ? (
            <EmptyState
              heading="No import runs"
              image="https://cdn.shopify.com/b/shopify-brochure/assets/empty-states/empty-state.svg"
            >
              <p>Run a Batson sync to generate diffs or adjust filters above.</p>
            </EmptyState>
          ) : (
            <BlockStack gap="200">
              {data.runs.map(run => (
                <Box key={run.id} padding="300" borderWidth="025" borderRadius="200" borderColor="border">
                  <InlineStack align="space-between">
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h3" variant="headingMd">
                          {run.supplierSlug}
                        </Text>
                        <Badge tone={badgeTone(run.status)}>{STATUS_LABELS[run.status] || run.status}</Badge>
                      </InlineStack>
                      <Text as="p" tone="subdued">
                        Started {formatDate(run.startedAt)} • {formatDuration(run.durationMs)}
                      </Text>
                    </BlockStack>
                    <InlineStack gap="200" align="center">
                      <InlineStack gap="100">
                        <Stat label="Adds" value={run.totalAdds} tone="success" />
                        <Stat label="Changes" value={run.totalChanges} tone="caution" />
                        <Stat label="Deletes" value={run.totalDeletes} tone="critical" />
                      </InlineStack>
                      <Button url={`/app/import-runs/${run.id}`} variant="primary">
                        View details
                      </Button>
                    </InlineStack>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          )}
        </Card>
      </BlockStack>
    </Page>
  )
}

function buildSupplierOptions(current: string, seen: string[]) {
  const unique = new Set<string>()
  if (current) unique.add(current)
  for (const slug of seen) unique.add(slug)
  return [{ label: 'All suppliers', value: '' }, ...[...unique].map(value => ({ label: value || 'unknown', value }))]
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs < 0) return 'duration pending'
  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSeconds = seconds % 60
  return `${minutes}m ${remSeconds}s`
}

function badgeTone(status: string): 'success' | 'critical' | 'attention' | 'info' {
  if (status === 'applied') return 'success'
  if (status === 'applied_with_warnings') return 'attention'
  if (status === 'failed' || status === 'error') return 'critical'
  if (status === 'pending') return 'attention'
  return 'info'
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'critical' | 'caution' }) {
  return (
    <BlockStack gap="025" align="center">
      <Text as="span" tone="subdued">
        {label}
      </Text>
      <Text as="span" tone={tone} variant="headingLg">
        {value}
      </Text>
    </BlockStack>
  )
}
