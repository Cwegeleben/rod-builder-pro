import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData, useRevalidator } from '@remix-run/react'
import {
  Card,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  InlineGrid,
  Button,
  List,
  Tabs,
  ButtonGroup,
  TextField,
} from '@shopify/polaris'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { authenticate } from '../shopify.server'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadDesignStudioMetrics } from '../lib/designStudio/metrics.server'
import { loadDesignStudioFamilyStats } from '../lib/designStudio/families.server'
import type { DesignStudioFamilyStats } from '../lib/designStudio/families.server'
import { loadDesignStudioComponentStats } from '../lib/designStudio/components.server'
import type { DesignStudioComponentStats } from '../lib/designStudio/components.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const designStudioAccess = await getDesignStudioAccess(request)
  if (!designStudioAccess.enabled) {
    throw new Response('Not Found', { status: 404 })
  }
  const metricsPromise = loadDesignStudioMetrics()
  const tenantConfig = extractTenantConfig(designStudioAccess.config)
  const familyStatsPromise = loadDesignStudioFamilyStats()
  const componentStatsPromise = loadDesignStudioComponentStats()
  const [metrics, familyStats, componentStats] = await Promise.all([
    metricsPromise,
    familyStatsPromise,
    componentStatsPromise,
  ])
  const families = mergeFamilyStats(familyStats, tenantConfig.curatedFamilies)
  return json({ designStudioAccess, metrics, tenantConfig, families, componentStats })
}

export default function DesignStudioOverview() {
  const { designStudioAccess, metrics, tenantConfig, families, componentStats } = useLoaderData<typeof loader>()
  const [selectedTab, setSelectedTab] = useState(0)
  const handleTabChange = useCallback((index: number) => setSelectedTab(index), [])
  const tabs = useMemo(
    () => [
      { id: 'overview', content: 'Overview' },
      { id: 'families', content: 'Families' },
      { id: 'components', content: 'Components' },
    ],
    [],
  )
  const readyLink = buildProductsLink({ ready: 'ready' })
  const needsReviewLink = buildProductsLink({ ready: 'not-ready' })

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h1" variant="headingXl">
                Design Studio overview
              </Text>
              <Text as="p" tone="subdued">
                {designStudioAccess.shopDomain}
              </Text>
            </BlockStack>
            <Badge tone="success">{designStudioAccess.tier}</Badge>
          </InlineStack>
          {tenantConfig.featureFlags.length ? (
            <BlockStack gap="100">
              <Text as="p" tone="subdued">
                Feature flags
              </Text>
              <InlineStack gap="200">
                {tenantConfig.featureFlags.map(flag => (
                  <Badge key={flag.label} tone={flag.enabled ? 'success' : 'critical'}>
                    {flag.label}
                  </Badge>
                ))}
              </InlineStack>
            </BlockStack>
          ) : null}
        </BlockStack>
      </Card>

      {!metrics.canonicalEnabled ? (
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Canonical products disabled
            </Text>
            <Text as="p" tone="subdued">
              Set PRODUCT_DB_ENABLED=1 to populate Design Studio metrics from the canonical product database.
            </Text>
          </BlockStack>
        </Card>
      ) : null}

      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} fitted />

      {selectedTab === 0 ? (
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <MetricCard
              title="Ready SKUs"
              value={metrics.readyCount}
              description="Importer + audits confirmed these SKUs are safe for Design Studio."
              actionLabel="View ready list"
              actionUrl={readyLink}
            />
            <MetricCard
              title="Needs review"
              value={metrics.needsReviewCount}
              description="Missing compatibility fields or coverage notes."
              actionLabel="Review in products"
              actionUrl={needsReviewLink}
            />
            <MetricCard
              title="Last audit"
              value={metrics.lastAuditAt ? formatDate(metrics.lastAuditAt) : '—'}
              description="Latest importer annotation snapshot saved into DesignStudioAnnotationAudit."
            />
          </InlineGrid>

          {metrics.roleBreakdown.length ? (
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Ready SKUs by role
                </Text>
                <List>
                  {metrics.roleBreakdown.map(item => (
                    <List.Item key={item.role}>
                      <InlineStack align="space-between">
                        <Text as="span">{formatRole(item.role)}</Text>
                        <Text as="span" tone="subdued">
                          {item.count} sku{item.count === 1 ? '' : 's'}
                        </Text>
                      </InlineStack>
                    </List.Item>
                  ))}
                </List>
              </BlockStack>
            </Card>
          ) : null}

          {metrics.familyBreakdown.length ? (
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Top ready families
                </Text>
                <List>
                  {metrics.familyBreakdown.map(item => (
                    <List.Item key={item.family}>
                      <InlineStack align="space-between" gap="200">
                        <Text as="span">{item.family}</Text>
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="span" tone="subdued">
                            {item.count} sku{item.count === 1 ? '' : 's'}
                          </Text>
                          <Button url={buildProductsLink({ family: item.family })} variant="plain">
                            Open in products
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </List.Item>
                  ))}
                </List>
              </BlockStack>
            </Card>
          ) : null}

          {tenantConfig.curatedFamilies.length ? (
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Curated families
                </Text>
                <BlockStack gap="200">
                  {tenantConfig.curatedFamilies.map((family, index) => (
                    <BlockStack key={`${family.handle || family.label || 'family'}-${index}`} gap="100">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingSm">
                          {family.label || family.handle}
                        </Text>
                        <Badge>{family.defaultFulfillmentMode || 'RBP_BUILD'}</Badge>
                      </InlineStack>
                      {family.notes ? (
                        <Text as="p" tone="subdued">
                          {family.notes}
                        </Text>
                      ) : null}
                    </BlockStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          ) : null}
        </BlockStack>
      ) : null}

      {selectedTab === 1 ? <FamiliesTab families={families} /> : null}

      {selectedTab === 2 ? <ComponentsTab stats={componentStats} /> : null}
    </BlockStack>
  )
}

type FeatureFlagSummary = { label: string; enabled: boolean }
type CuratedFamilySummary = {
  handle?: string
  label?: string
  defaultFulfillmentMode?: string
  notes?: string
  coverageScore?: number
}

type TenantConfigSummary = {
  featureFlags: FeatureFlagSummary[]
  curatedFamilies: CuratedFamilySummary[]
}

function extractTenantConfig(config: unknown): TenantConfigSummary {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { featureFlags: [], curatedFamilies: [] }
  }
  const cfg = config as Record<string, unknown>
  const featureFlags: FeatureFlagSummary[] = []
  const flagsRaw = cfg.featureFlags
  if (flagsRaw && typeof flagsRaw === 'object' && !Array.isArray(flagsRaw)) {
    const prettyLabels: Record<string, string> = {
      savedBuilds: 'Saved builds',
      exportToS3: 'Export to S3',
      dropship: 'Dropship mode',
    }
    for (const key of Object.keys(flagsRaw)) {
      const value = Boolean((flagsRaw as Record<string, unknown>)[key])
      featureFlags.push({ label: prettyLabels[key] || key, enabled: value })
    }
    featureFlags.sort((a, b) => a.label.localeCompare(b.label))
  }

  const familiesRaw = cfg.curatedFamilies
  const curatedFamilies = Array.isArray(familiesRaw)
    ? familiesRaw
        .map(entry => (entry && typeof entry === 'object' ? (entry as CuratedFamilySummary) : null))
        .filter((entry): entry is CuratedFamilySummary => !!entry)
    : []

  return {
    featureFlags,
    curatedFamilies,
  }
}

function formatDate(value: string): string {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  } catch {
    return value
  }
}

function formatRole(role: string): string {
  const map: Record<string, string> = {
    blank: 'Blank',
    handle: 'Handle',
    guide_set: 'Guide set',
    guide: 'Guide',
    guide_tip: 'Tip top',
    reel_seat: 'Reel seat',
    accessory: 'Accessory',
    component: 'Component',
  }
  return map[role] || role
}

type ProductsFilter = {
  ready?: 'ready' | 'not-ready'
  family?: string
  role?: string
}

function buildProductsLink(filter: ProductsFilter): string {
  const params = new URLSearchParams()
  params.set('view', 'all')
  if (filter.ready) params.append('dsReady', filter.ready)
  if (filter.family) params.set('dsFamily', filter.family)
  if (filter.role) params.set('dsRole', filter.role)
  return `/app/products?${params.toString()}`
}

type MetricCardProps = {
  title: string
  value: string | number
  description: string
  actionLabel?: string
  actionUrl?: string
}

function MetricCard({ title, value, description, actionLabel, actionUrl }: MetricCardProps) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        <Text as="p" variant="headingXl">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        <Text as="p" tone="subdued">
          {description}
        </Text>
        {actionLabel && actionUrl ? (
          <Button url={actionUrl} variant="primary">
            {actionLabel}
          </Button>
        ) : null}
      </BlockStack>
    </Card>
  )
}

type FamilyRow = {
  familyKey: string
  label: string
  readyCount: number
  needsReviewCount: number
  lastTouchedAt: string | null
  coverageScore?: number
  defaultFulfillmentMode?: string
  notes?: string
}

function mergeFamilyStats(stats: DesignStudioFamilyStats[], curatedFamilies: CuratedFamilySummary[]): FamilyRow[] {
  const rows: FamilyRow[] = []
  const curatedMatchIndex = new Map<string, CuratedFamilySummary>()
  curatedFamilies.forEach(entry => {
    const handle = entry.handle?.toLowerCase()
    const label = entry.label?.toLowerCase()
    if (handle) curatedMatchIndex.set(handle, entry)
    if (label) curatedMatchIndex.set(label, entry)
  })

  const seenKeys = new Set<string>()
  for (const stat of stats) {
    const key = stat.family.toLowerCase()
    seenKeys.add(key)
    const matched = curatedMatchIndex.get(key)
    rows.push({
      familyKey: stat.family,
      label: matched?.label || stat.family,
      readyCount: stat.readyCount,
      needsReviewCount: stat.needsReviewCount,
      lastTouchedAt: stat.lastTouchedAt,
      coverageScore: matched?.coverageScore,
      defaultFulfillmentMode: matched?.defaultFulfillmentMode,
      notes: matched?.notes,
    })
  }

  curatedFamilies.forEach(entry => {
    const key = (entry.label || entry.handle || '').toLowerCase()
    if (key && seenKeys.has(key)) return
    rows.push({
      familyKey: entry.label || entry.handle || 'Family',
      label: entry.label || entry.handle || 'Family',
      readyCount: 0,
      needsReviewCount: 0,
      lastTouchedAt: null,
      coverageScore: entry.coverageScore,
      defaultFulfillmentMode: entry.defaultFulfillmentMode,
      notes: entry.notes,
    })
  })

  return rows.sort((a, b) => {
    if (b.readyCount !== a.readyCount) return b.readyCount - a.readyCount
    return a.label.localeCompare(b.label)
  })
}

type FamiliesTabProps = { families: FamilyRow[] }

function FamiliesTab({ families }: FamiliesTabProps) {
  if (!families.length) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Families
          </Text>
          <Text as="p" tone="subdued">
            No Design Studio families have been marked ready yet.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          Families
        </Text>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="py-2 pr-4">Family</th>
                <th className="py-2 pr-4">Ready</th>
                <th className="py-2 pr-4">Needs review</th>
                <th className="py-2 pr-4">Coverage</th>
                <th className="py-2 pr-4">Last touch</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {families.map(row => (
                <tr key={`${row.familyKey}-${row.label}`} className="border-t border-slate-100">
                  <td className="py-2 pr-4">
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd">
                        {row.label}
                      </Text>
                      {row.defaultFulfillmentMode ? (
                        <Text as="span" tone="subdued">
                          {row.defaultFulfillmentMode}
                        </Text>
                      ) : null}
                    </BlockStack>
                  </td>
                  <td className="py-2 pr-4">{row.readyCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">{row.needsReviewCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    {row.coverageScore != null ? `${Math.round(row.coverageScore * 100)}%` : '—'}
                  </td>
                  <td className="py-2 pr-4">{row.lastTouchedAt ? formatDate(row.lastTouchedAt) : '—'}</td>
                  <td className="py-2 pr-4">
                    <Button
                      url={buildProductsLink({ family: row.familyKey })}
                      variant="plain"
                      accessibilityLabel={`Open ${row.label} in products`}
                    >
                      Open in products
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BlockStack>
    </Card>
  )
}

type ComponentsTabProps = { stats: DesignStudioComponentStats[] }

type ComponentSku = DesignStudioComponentStats['topSkus'][number]
type DesignStudioActionResponse = { ok?: boolean; message?: string }

function ComponentsTab({ stats }: ComponentsTabProps) {
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const revalidator = useRevalidator()
  useEffect(() => {
    if (roleFilter === 'all') return
    const stillExists = stats.some(stat => stat.role === roleFilter)
    if (!stillExists) setRoleFilter('all')
  }, [stats, roleFilter])
  const roleOptions = useMemo(() => stats.map(stat => stat.role), [stats])
  const currentFilter = roleFilter === 'all' ? 'all' : roleOptions.includes(roleFilter) ? roleFilter : 'all'
  const filteredStats = currentFilter === 'all' ? stats : stats.filter(stat => stat.role === currentFilter)
  const readinessTotals = useMemo(
    () =>
      filteredStats.reduce(
        (acc, stat) => {
          acc.ready += stat.readyCount
          acc.review += stat.needsReviewCount
          return acc
        },
        { ready: 0, review: 0 },
      ),
    [filteredStats],
  )
  const filterLabel = currentFilter === 'all' ? 'all roles' : `${formatRole(currentFilter)} role`
  const readyLink = buildProductsLink({ role: currentFilter === 'all' ? undefined : currentFilter, ready: 'ready' })
  const reviewLink = buildProductsLink({
    role: currentFilter === 'all' ? undefined : currentFilter,
    ready: 'not-ready',
  })
  if (!stats.length) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Components
          </Text>
          <Text as="p" tone="subdued">
            Enable PRODUCT_DB_ENABLED=1 and ensure importer runs have stamped DS roles before this tab shows data.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center" wrap={false} gap="200">
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">
              Components
            </Text>
            <Text as="p" tone="subdued">
              Showing {filterLabel} covering {readinessTotals.ready.toLocaleString()} ready and{' '}
              {readinessTotals.review.toLocaleString()} needs-review SKUs.
            </Text>
          </BlockStack>
          {roleOptions.length > 1 ? (
            <InlineStack gap="100" blockAlign="center">
              <Text as="span" tone="subdued">
                Filter by role
              </Text>
              <ButtonGroup>
                <Button pressed={currentFilter === 'all'} onClick={() => setRoleFilter('all')}>
                  All
                </Button>
                {roleOptions.map(role => (
                  <Button key={role} pressed={currentFilter === role} onClick={() => setRoleFilter(role)}>
                    {formatRole(role)}
                  </Button>
                ))}
              </ButtonGroup>
            </InlineStack>
          ) : null}
        </InlineStack>

        <InlineStack gap="200">
          <Button url={readyLink} variant="secondary">
            View ready list
          </Button>
          <Button url={reviewLink} variant="tertiary">
            Review backlog
          </Button>
        </InlineStack>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Ready</th>
                <th className="py-2 pr-4">Needs review</th>
                <th className="py-2 pr-4">Top SKUs</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map(item => (
                <tr key={item.role} className="border-t border-slate-100">
                  <td className="py-2 pr-4">{formatRole(item.role)}</td>
                  <td className="py-2 pr-4">{item.readyCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">{item.needsReviewCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <BlockStack gap="100">
                      {item.topSkus.length ? (
                        item.topSkus.map(sku => (
                          <ComponentSkuRow key={sku.productId} sku={sku} revalidator={revalidator} />
                        ))
                      ) : (
                        <Text as="span" tone="subdued">
                          Importer has not surfaced SKUs for this role yet.
                        </Text>
                      )}
                    </BlockStack>
                  </td>
                  <td className="py-2 pr-4">
                    <InlineStack gap="200">
                      <Button variant="secondary" url={buildProductsLink({ role: item.role, ready: 'ready' })}>
                        Ready
                      </Button>
                      <Button variant="tertiary" url={buildProductsLink({ role: item.role, ready: 'not-ready' })}>
                        Review
                      </Button>
                    </InlineStack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BlockStack>
    </Card>
  )
}

type ComponentSkuRowProps = {
  sku: ComponentSku
  revalidator: ReturnType<typeof useRevalidator>
}

function ComponentSkuRow({ sku, revalidator }: ComponentSkuRowProps) {
  const fetcher = useFetcher<DesignStudioActionResponse>()
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteDraft, setNoteDraft] = useState(sku.coverageNotes || '')
  const busy = fetcher.state !== 'idle'
  const currentIntent = fetcher.formData?.get('intent')?.toString()
  useEffect(() => {
    setNoteDraft(sku.coverageNotes || '')
  }, [sku.coverageNotes])
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      setEditingNotes(false)
      revalidator.revalidate()
    }
  }, [fetcher.state, fetcher.data, revalidator])

  const submitAction = useCallback(
    (fields: Record<string, string>) => {
      const data = new FormData()
      data.append('productId', sku.productId)
      Object.entries(fields).forEach(([key, value]) => data.append(key, value))
      fetcher.submit(data, { method: 'post', action: '/api/design-studio/annotations' })
    },
    [fetcher, sku.productId],
  )

  const handleReady = useCallback(
    (ready: boolean) => {
      submitAction({ intent: 'set-ready', ready: ready ? '1' : '0' })
    },
    [submitAction],
  )

  const handleNotesSave = useCallback(() => {
    submitAction({ intent: 'update-notes', coverageNotes: noteDraft })
  }, [submitAction, noteDraft])

  const handleRecalc = useCallback(() => {
    submitAction({ intent: 'recalc-compatibility' })
  }, [submitAction])

  return (
    <div className="rounded-md border border-slate-100 p-3">
      <BlockStack gap="100">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd">
              {sku.sku}
            </Text>
            <Text as="span" tone="subdued">
              {sku.family || 'Unassigned'}
            </Text>
          </BlockStack>
          <Badge tone={sku.ready ? 'success' : 'critical'}>{sku.ready ? 'Ready' : 'Needs review'}</Badge>
        </InlineStack>
        {sku.coverageNotes ? (
          <Text as="span" tone="subdued">
            {sku.coverageNotes}
          </Text>
        ) : null}
        {editingNotes ? (
          <BlockStack gap="100">
            <TextField
              label="Coverage notes"
              labelHidden
              value={noteDraft}
              onChange={value => setNoteDraft(value)}
              multiline
              autoComplete="off"
            />
            <InlineStack gap="100" wrap>
              <Button
                size="slim"
                variant="primary"
                loading={busy && currentIntent === 'update-notes'}
                onClick={handleNotesSave}
              >
                Save note
              </Button>
              <Button
                size="slim"
                variant="tertiary"
                onClick={() => {
                  setEditingNotes(false)
                  setNoteDraft(sku.coverageNotes || '')
                }}
              >
                Cancel
              </Button>
            </InlineStack>
          </BlockStack>
        ) : null}
        <InlineStack gap="100" wrap>
          <Button
            size="slim"
            variant="secondary"
            loading={busy && currentIntent === 'set-ready' && fetcher.formData?.get('ready') === '1'}
            onClick={() => handleReady(true)}
          >
            Mark ready
          </Button>
          <Button
            size="slim"
            variant="tertiary"
            loading={busy && currentIntent === 'set-ready' && fetcher.formData?.get('ready') === '0'}
            onClick={() => handleReady(false)}
          >
            Needs review
          </Button>
          <Button size="slim" variant="tertiary" onClick={() => setEditingNotes(value => !value)}>
            {editingNotes ? 'Hide notes' : sku.coverageNotes ? 'Edit notes' : 'Add note'}
          </Button>
          <Button
            size="slim"
            variant="plain"
            loading={busy && currentIntent === 'recalc-compatibility'}
            onClick={handleRecalc}
          >
            Recalc compatibility
          </Button>
        </InlineStack>
        {fetcher.data && fetcher.data.ok === false && fetcher.data.message ? (
          <Text as="span" tone="critical">
            {fetcher.data.message}
          </Text>
        ) : null}
      </BlockStack>
    </div>
  )
}

function ComponentsPlaceholder() {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          Components (coming soon)
        </Text>
        <Text as="p" tone="subdued">
          This tab will summarize readiness by component role and surface shortcuts into /app/products once the data
          grid implementation lands later in Phase 1.
        </Text>
      </BlockStack>
    </Card>
  )
}
