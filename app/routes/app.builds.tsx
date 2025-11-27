import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, Form, useFetcher } from '@remix-run/react'
import { useEffect, useMemo, useState, useCallback, type ComponentProps } from 'react'
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Select,
  Text,
  TextField,
  Modal,
  Spinner,
  Divider,
  ButtonGroup,
  Icon,
} from '@shopify/polaris'
import type { IconSource } from '@shopify/polaris/build/ts/src/types'
import type { DesignBuildStatus, DesignStudioTier } from '@prisma/client'
import {
  AttachmentIcon,
  ChatIcon,
  ClockIcon,
  DeliveryIcon,
  ExportIcon,
  NoteIcon,
  AlertCircleIcon,
} from '@shopify/polaris-icons'
import { authenticate } from '../shopify.server'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadDesignBuildQueue } from '../lib/designStudio/builds.server'
import { QUEUE_STATUS_ORDER, QUEUE_STATUS_LABELS } from '../lib/designStudio/types'
import type {
  DesignBuildQueueGroup,
  DesignBuildSummary,
  DesignBuildDetail,
  DesignBuildActionIntent,
} from '../lib/designStudio/types'
import { parseDesignBuildComponentSummary, stringifyDesignBuildNotes } from '../lib/designStudio/summary'

type DrawerActionIntent = DesignBuildActionIntent | 'export'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const designStudioAccess = await getDesignStudioAccess(request)
  if (!designStudioAccess.enabled || !designStudioAccess.shopDomain) {
    throw new Response('Not Found', { status: 404 })
  }

  const url = new URL(request.url)
  const statusFilter = parseStatus(url.searchParams.get('status'))
  const tierFilter = parseTier(url.searchParams.get('tier'))
  const search = (url.searchParams.get('q') || '').trim().slice(0, 120) || null

  const queue = await loadDesignBuildQueue({
    shopDomain: designStudioAccess.shopDomain,
    status: statusFilter || undefined,
    tier: tierFilter || undefined,
    search,
  })

  return json({
    designStudioAccess,
    queue,
    filters: {
      status: statusFilter,
      tier: tierFilter,
      search,
    },
  })
}

export default function DesignStudioBuildsRoute() {
  const { designStudioAccess, queue, filters } = useLoaderData<typeof loader>()
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [statusValue, setStatusValue] = useState(filters.status || 'all')
  const [tierValue, setTierValue] = useState(filters.tier || 'all')
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null)
  const detailFetcher = useFetcher<DesignBuildDetail>()
  const actionFetcher = useFetcher<{
    ok: boolean
    error?: string | null
    export?: { url: string; exportedAt: string; key: string }
  }>()
  const [pendingAction, setPendingAction] = useState<DrawerActionIntent | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setSearchValue(filters.search || '')
  }, [filters.search])
  useEffect(() => {
    setStatusValue(filters.status || 'all')
  }, [filters.status])
  useEffect(() => {
    setTierValue(filters.tier || 'all')
  }, [filters.tier])

  useEffect(() => {
    if (!selectedBuildId) return
    detailFetcher.load(`/api/design-studio/builds/${selectedBuildId}`)
  }, [selectedBuildId, detailFetcher])

  useEffect(() => {
    setRequestNote('')
    setActionError(null)
    setPendingAction(null)
  }, [selectedBuildId])

  useEffect(() => {
    if (actionFetcher.state !== 'idle') return
    if (pendingAction) setPendingAction(null)
    if (!selectedBuildId) return
    if (actionFetcher.data?.ok) {
      detailFetcher.load(`/api/design-studio/builds/${selectedBuildId}`)
      setRequestNote('')
      setActionError(null)
    } else if (actionFetcher.data && actionFetcher.data.error) {
      setActionError(actionFetcher.data.error)
    }
  }, [actionFetcher.state, actionFetcher.data, detailFetcher, pendingAction, selectedBuildId])

  const handleAction = useCallback(
    (intent: DrawerActionIntent, note?: string) => {
      if (!selectedBuildId) return
      if (intent === 'request_edits' && !note?.trim()) {
        setActionError('Add a note before requesting edits.')
        return
      }
      const formData = new FormData()
      if (intent === 'export') {
        formData.append('_action', 'export_build')
      } else {
        formData.append('_action', intent)
        if (note?.trim()) {
          formData.append('note', note.trim())
        }
      }
      setPendingAction(intent)
      setActionError(null)
      actionFetcher.submit(formData, {
        method: 'post',
        action: `/api/design-studio/builds/${selectedBuildId}`,
      })
    },
    [actionFetcher, selectedBuildId],
  )

  const handleSelectBuild = useCallback((id: string) => {
    setSelectedBuildId(id)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedBuildId(null)
  }, [])

  const totalBuilds = useMemo(() => queue.reduce((sum, group) => sum + group.totalCount, 0), [queue])
  const emptyState = totalBuilds === 0
  const exportEnabled = useMemo(() => canExportBuilds(designStudioAccess.config), [designStudioAccess.config])

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text as="h1" variant="headingXl">
                Design Studio builds
              </Text>
              <Text as="p" tone="subdued">
                {designStudioAccess.shopDomain}
              </Text>
            </BlockStack>
            <Badge tone="info">{designStudioAccess.tier}</Badge>
          </InlineStack>
          <Text as="p" tone="subdued">
            Track every build submission by status, tier, and fulfillment mode. Filters run server-side so the queue
            reflects the latest importer + storefront events.
          </Text>
        </BlockStack>
      </Card>

      <Card>
        <Form method="get">
          <InlineStack gap="200" wrap>
            <TextField
              label="Search"
              name="q"
              value={searchValue}
              onChange={(next: string) => setSearchValue(next)}
              autoComplete="off"
              placeholder="Reference, customer, SKU"
            />
            <Select
              label="Status"
              name="status"
              value={statusValue}
              onChange={(next: string) => setStatusValue(next)}
              options={buildStatusOptions()}
            />
            <Select
              label="Tier"
              name="tier"
              value={tierValue}
              onChange={(next: string) => setTierValue(next)}
              options={buildTierOptions()}
            />
            <div className="self-end">
              <Button submit variant="primary">
                Apply filters
              </Button>
            </div>
          </InlineStack>
        </Form>
      </Card>

      {emptyState ? (
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              No builds yet
            </Text>
            <Text as="p" tone="subdued">
              Once customers submit Design Studio requests, they will appear here with status groupings and tier
              filters.
            </Text>
          </BlockStack>
        </Card>
      ) : null}

      {queue.map(group => (
        <BuildStatusSection key={group.status} group={group} onSelectBuild={handleSelectBuild} />
      ))}

      <Modal
        open={Boolean(selectedBuildId)}
        onClose={handleCloseDrawer}
        title={detailFetcher.data?.build.reference || 'Design build details'}
        size="large"
      >
        <Modal.Section>
          {!selectedBuildId ? (
            <Text as="p" tone="subdued">
              Select a build to view details.
            </Text>
          ) : detailFetcher.state !== 'idle' && !detailFetcher.data ? (
            <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
              <Spinner accessibilityLabel="Loading build" size="large" />
            </div>
          ) : detailFetcher.data ? (
            <BuildDetailContent
              detail={detailFetcher.data}
              onAction={handleAction}
              actionPending={actionFetcher.state !== 'idle'}
              pendingAction={pendingAction}
              actionError={actionError}
              requestNote={requestNote}
              onRequestNoteChange={setRequestNote}
              exportEnabled={exportEnabled}
            />
          ) : (
            <Text as="p" tone="critical">
              Unable to load build details.
            </Text>
          )}
        </Modal.Section>
      </Modal>
    </BlockStack>
  )
}

function BuildStatusSection({
  group,
  onSelectBuild,
}: {
  group: DesignBuildQueueGroup
  onSelectBuild: (id: string) => void
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="150" blockAlign="center">
            <Badge tone={badgeToneForStatus(group.status)}>{group.label}</Badge>
            <Text as="span" tone="subdued">
              {group.totalCount} build{group.totalCount === 1 ? '' : 's'}
            </Text>
          </InlineStack>
        </InlineStack>
        {!group.builds.length ? (
          <Text as="p" tone="subdued">
            No builds currently in this status.
          </Text>
        ) : (
          <BlockStack gap="150">
            {group.builds.map(build => (
              <div key={build.id} className="rounded-md border border-slate-100 p-4">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <BlockStack gap="050">
                    <InlineStack gap="150" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        {build.reference}
                      </Text>
                      <Badge tone={badgeToneForStatus(build.status)}>{QUEUE_STATUS_LABELS[build.status]}</Badge>
                    </InlineStack>
                    <InlineStack gap="100" wrap>
                      {build.customerName ? <Text as="span">{build.customerName}</Text> : null}
                      {build.customerEmail ? (
                        <Text as="span" tone="subdued">
                          {build.customerEmail}
                        </Text>
                      ) : null}
                    </InlineStack>
                    <InlineStack gap="200" wrap>
                      {build.blankSku ? <Badge>{`Blank: ${build.blankSku}`}</Badge> : null}
                      <Badge tone="info">{build.tier}</Badge>
                      <Badge tone="attention">{formatFulfillmentMode(build.fulfillmentMode)}</Badge>
                    </InlineStack>
                  </BlockStack>
                  <BlockStack align="end" gap="050">
                    <Text as="span" tone="subdued">
                      Updated {formatDate(build.updatedAt)}
                    </Text>
                    {build.promisedShipWeek ? (
                      <Text as="span">Ship wk {formatWeek(build.promisedShipWeek)}</Text>
                    ) : null}
                    {build.assignedBuilder ? (
                      <Text as="span" tone="subdued">
                        Assigned to {build.assignedBuilder}
                      </Text>
                    ) : null}
                    <Button size="slim" onClick={() => onSelectBuild(build.id)}>
                      Open build
                    </Button>
                  </BlockStack>
                </InlineStack>
              </div>
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  )
}

type BuildDetailContentProps = {
  detail: DesignBuildDetail
  onAction: (intent: DrawerActionIntent, note?: string) => void
  actionPending: boolean
  pendingAction: DrawerActionIntent | null
  actionError: string | null
  requestNote: string
  onRequestNoteChange: (value: string) => void
  exportEnabled: boolean
}

function BuildDetailContent({
  detail,
  onAction,
  actionPending,
  pendingAction,
  actionError,
  requestNote,
  onRequestNoteChange,
  exportEnabled,
}: BuildDetailContentProps) {
  const { build, events } = detail
  const summary = parseDesignBuildComponentSummary(build.componentSummary)
  const notes = stringifyDesignBuildNotes(build.notesJson)
  const timelineGroups = useMemo(() => groupTimelineEvents(events), [events])
  const canApprove = build.status === 'REVIEW'
  const canSchedule = build.status === 'APPROVED'
  const canRequestEdits = build.status !== 'ARCHIVED' && build.status !== 'FULFILLED'
  const isPending = (intent: DrawerActionIntent) => actionPending && pendingAction === intent
  const exportEvent = findLatestExportEvent(events)
  const exportUrl = extractPayloadString(exportEvent?.payload, 'url')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  useEffect(() => {
    if (copyState !== 'copied') return
    const timer = setTimeout(() => setCopyState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [copyState])

  const handleCopyExportLink = useCallback(async () => {
    if (!exportUrl) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportUrl)
        setCopyState('copied')
      } else {
        throw new Error('clipboard unavailable')
      }
    } catch {
      if (typeof window !== 'undefined' && window.prompt) {
        window.prompt('Copy export link', exportUrl)
      }
    }
  }, [exportUrl])
  return (
    <BlockStack gap="300">
      <BlockStack gap="050">
        <Text as="h2" variant="headingLg">
          {build.reference}
        </Text>
        <InlineStack gap="100" wrap>
          <Badge tone={badgeToneForStatus(build.status)}>{QUEUE_STATUS_LABELS[build.status]}</Badge>
          <Badge tone="info">{build.tier}</Badge>
          <Badge tone="attention">{formatFulfillmentMode(build.fulfillmentMode)}</Badge>
        </InlineStack>
        <Text as="span" tone="subdued">
          Created {formatDate(build.createdAt)}
          {build.updatedAt ? ` · Updated ${formatDate(build.updatedAt)}` : ''}
        </Text>
      </BlockStack>

      <Divider />

      <BlockStack gap="150">
        <Text as="h3" variant="headingMd">
          Customer
        </Text>
        <BlockStack gap="050">
          <Text as="p">{build.customerName || '—'}</Text>
          {build.customerEmail ? (
            <Text as="p" tone="subdued">
              {build.customerEmail}
            </Text>
          ) : null}
          {build.customerPhone ? (
            <Text as="p" tone="subdued">
              {build.customerPhone}
            </Text>
          ) : null}
          {build.useCase ? (
            <Text as="p" tone="subdued">
              Use case: {build.useCase}
            </Text>
          ) : null}
          {build.experienceLevel ? (
            <Text as="p" tone="subdued">
              Experience: {build.experienceLevel}
            </Text>
          ) : null}
        </BlockStack>
      </BlockStack>

      <Divider />

      <BlockStack gap="150">
        <Text as="h3" variant="headingMd">
          Fulfillment
        </Text>
        <InlineStack gap="200" wrap>
          {build.promisedShipWeek ? <Badge tone="info">{`Ship wk ${formatWeek(build.promisedShipWeek)}`}</Badge> : null}
          {build.assignedBuilder ? <Badge tone="success">{`Assigned: ${build.assignedBuilder}`}</Badge> : null}
          {build.budgetCeiling ? <Badge tone="info">{`Budget: $${build.budgetCeiling}`}</Badge> : null}
        </InlineStack>
        {build.blockedReason ? (
          <Text as="p" tone="critical">
            Blocked: {build.blockedReason}
          </Text>
        ) : null}
      </BlockStack>

      <Divider />

      <BlockStack gap="150">
        <Text as="h3" variant="headingMd">
          Bill of materials
        </Text>
        {summary.blank ? (
          <div className="rounded-md border border-slate-100 p-3">
            <BlockStack gap="050">
              <Text as="h4" variant="headingSm">
                Blank
              </Text>
              <Text as="p">{summary.blank.title || summary.blank.sku || '—'}</Text>
              <InlineStack gap="100" wrap>
                {summary.blank.sku ? <Badge>{summary.blank.sku}</Badge> : null}
                {summary.blank.ready != null ? (
                  <Badge tone={summary.blank.ready ? 'success' : 'critical'}>
                    {summary.blank.ready ? 'Ready' : 'Needs review'}
                  </Badge>
                ) : null}
              </InlineStack>
              {summary.blank.notes ? (
                <Text as="p" tone="subdued">
                  {summary.blank.notes}
                </Text>
              ) : null}
            </BlockStack>
          </div>
        ) : (
          <Text as="p" tone="subdued">
            No blank recorded.
          </Text>
        )}
        <BlockStack gap="100">
          {summary.components.length ? (
            summary.components.map((component, index) => (
              <div
                key={`${component.sku || component.title || 'component'}-${index}`}
                className="rounded-md border border-slate-100 p-3"
              >
                <BlockStack gap="050">
                  <InlineStack gap="100" blockAlign="center">
                    <Text as="h4" variant="headingSm">
                      {component.role ? formatRole(component.role) : 'Component'}
                    </Text>
                    {component.ready != null ? (
                      <Badge tone={component.ready ? 'success' : 'critical'}>
                        {component.ready ? 'Ready' : 'Needs review'}
                      </Badge>
                    ) : null}
                  </InlineStack>
                  <Text as="p">{component.title || component.sku || '—'}</Text>
                  <InlineStack gap="100" wrap>
                    {component.sku ? <Badge>{component.sku}</Badge> : null}
                  </InlineStack>
                  {component.notes ? (
                    <Text as="p" tone="subdued">
                      {component.notes}
                    </Text>
                  ) : null}
                </BlockStack>
              </div>
            ))
          ) : (
            <Text as="p" tone="subdued">
              No components captured.
            </Text>
          )}
        </BlockStack>
      </BlockStack>

      <Divider />

      <BlockStack gap="150">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd">
            Actions
          </Text>
          <Text as="p" tone="subdued">
            Update build status and notify the team.
          </Text>
        </InlineStack>
        {actionError ? (
          <Text as="p" tone="critical">
            {actionError}
          </Text>
        ) : null}
        <ButtonGroup>
          <Button
            size="slim"
            onClick={() => onAction('approve')}
            disabled={!canApprove || actionPending}
            loading={isPending('approve')}
          >
            Approve build
          </Button>
          <Button
            size="slim"
            onClick={() => onAction('request_edits', requestNote)}
            disabled={!canRequestEdits || actionPending}
            loading={isPending('request_edits')}
          >
            Request edits
          </Button>
          <Button
            size="slim"
            onClick={() => onAction('schedule')}
            disabled={!canSchedule || actionPending}
            loading={isPending('schedule')}
          >
            Schedule production
          </Button>
        </ButtonGroup>
        <TextField
          label="Request edits note"
          value={requestNote}
          onChange={onRequestNoteChange}
          multiline={4}
          autoComplete="off"
          disabled={!canRequestEdits || actionPending}
          helpText="Explain what needs to change before approval."
        />
        {exportEnabled ? (
          <BlockStack gap="050">
            <Button
              size="slim"
              variant="secondary"
              onClick={() => onAction('export')}
              disabled={actionPending}
              loading={isPending('export')}
            >
              Export build package
            </Button>
            {exportEvent ? (
              <InlineStack gap="100" blockAlign="center" wrap>
                <Badge tone="success" size="small">
                  {`Exported ${formatDate(exportEvent.createdAt)}`}
                </Badge>
                {exportUrl ? (
                  <Button size="slim" variant="plain" onClick={handleCopyExportLink}>
                    Copy link
                  </Button>
                ) : null}
                {copyState === 'copied' ? (
                  <Text as="span" tone="success">
                    Link copied
                  </Text>
                ) : null}
              </InlineStack>
            ) : (
              <Text as="p" tone="subdued">
                No exports recorded yet.
              </Text>
            )}
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">
            Enable export-to-S3 for this tenant to generate build packets.
          </Text>
        )}
      </BlockStack>

      <Divider />

      <BlockStack gap="150">
        <Text as="h3" variant="headingMd">
          Notes
        </Text>
        {notes ? (
          <Text as="p">{notes}</Text>
        ) : (
          <Text as="p" tone="subdued">
            No notes recorded yet.
          </Text>
        )}
      </BlockStack>

      <Divider />

      <BlockStack gap="150">
        <Text as="h3" variant="headingMd">
          Timeline
        </Text>
        {timelineGroups.length ? (
          <BlockStack gap="200">
            {timelineGroups.map(group => (
              <BlockStack key={group.label} gap="100">
                <Text as="h4" variant="headingSm" tone="subdued">
                  {group.label}
                </Text>
                <BlockStack gap="100">
                  {group.events.map(event => {
                    const meta = describeTimelineEvent(event)
                    const exportLink = event.eventType === 'EXPORT' ? extractPayloadString(event.payload, 'url') : null
                    return (
                      <div key={event.id} className="rounded-md border border-slate-100 p-3">
                        <BlockStack gap="050">
                          <InlineStack align="space-between" blockAlign="center" wrap>
                            <InlineStack gap="100" blockAlign="center">
                              <Icon source={meta.icon} tone={meta.iconTone} />
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </InlineStack>
                            <Text as="span" tone="subdued">
                              {formatTime(event.createdAt)}
                            </Text>
                          </InlineStack>
                          {meta.description ? (
                            <Text as="p" variant="bodySm">
                              {meta.description}
                            </Text>
                          ) : null}
                          {event.payload ? (
                            <Text as="p" tone="subdued">
                              {summarizePayload(event.payload)}
                            </Text>
                          ) : null}
                          <InlineStack gap="100" align="start" wrap>
                            {event.performedBy ? (
                              <Text as="span" tone="subdued">
                                By {event.performedBy}
                              </Text>
                            ) : null}
                            <Text as="span" tone="subdued">
                              {formatDate(event.createdAt)}
                            </Text>
                            {exportLink ? (
                              <Button size="slim" variant="plain" url={exportLink} external icon={ExportIcon}>
                                Open packet
                              </Button>
                            ) : null}
                          </InlineStack>
                        </BlockStack>
                      </div>
                    )
                  })}
                </BlockStack>
              </BlockStack>
            ))}
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">
            No timeline entries yet.
          </Text>
        )}
      </BlockStack>
    </BlockStack>
  )
}

function formatEventType(eventType: string) {
  const map: Record<string, string> = {
    NOTE: 'Note',
    STATUS_CHANGE: 'Status change',
    CUSTOMER_UPDATE: 'Customer update',
    FULFILLMENT_UPDATE: 'Fulfillment update',
    SLA_BREACH: 'SLA breach',
    FILE_ATTACHED: 'File attached',
  }
  return map[eventType] || eventType.replace(/_/g, ' ').toLowerCase()
}

function summarizePayload(payload: unknown): string {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload)
  try {
    const str = JSON.stringify(payload)
    return str.length > 120 ? `${str.slice(0, 117)}…` : str
  } catch {
    return 'Payload attached'
  }
}

function buildStatusOptions() {
  return [
    { label: 'All statuses', value: 'all' },
    ...QUEUE_STATUS_ORDER.map(status => ({
      label: QUEUE_STATUS_LABELS[status],
      value: status,
    })),
  ]
}

function buildTierOptions() {
  const tiers: DesignStudioTier[] = ['STARTER', 'CORE', 'PLUS', 'ENTERPRISE']
  return [
    { label: 'All tiers', value: 'all' },
    ...tiers.map(tier => ({ label: tier.charAt(0) + tier.slice(1).toLowerCase(), value: tier })),
  ]
}

function parseStatus(raw: string | null): DesignBuildStatus | null {
  if (!raw) return null
  return QUEUE_STATUS_ORDER.includes(raw as DesignBuildStatus) ? (raw as DesignBuildStatus) : null
}

function parseTier(raw: string | null): DesignStudioTier | null {
  if (!raw) return null
  const tiers: DesignStudioTier[] = ['STARTER', 'CORE', 'PLUS', 'ENTERPRISE']
  return tiers.includes(raw as DesignStudioTier) ? (raw as DesignStudioTier) : null
}

function canExportBuilds(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return false
  }
  const featureFlags = (config as Record<string, unknown>).featureFlags
  if (!featureFlags || typeof featureFlags !== 'object' || Array.isArray(featureFlags)) {
    return false
  }
  const exportFlag = (featureFlags as Record<string, unknown>).exportToS3
  return Boolean(exportFlag)
}

function findLatestExportEvent(events: DesignBuildDetail['events']) {
  return events.reduce<DesignBuildDetail['events'][number] | null>((latest, event) => {
    if (event.eventType !== 'EXPORT') return latest
    if (!latest) return event
    return new Date(event.createdAt).getTime() >= new Date(latest.createdAt).getTime() ? event : latest
  }, null)
}

function extractPayloadString(
  payload: DesignBuildDetail['events'][number]['payload'] | undefined,
  key: string,
): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : null
}

type TimelineGroupLabel = 'Today' | 'Yesterday' | 'Earlier'
type TimelineGroup = {
  label: TimelineGroupLabel
  events: DesignBuildDetail['events']
}

type PolarisIconSource = IconSource
type BadgeTone = ComponentProps<typeof Badge>['tone']
type IconTone = ComponentProps<typeof Icon>['tone']

type TimelineEventMeta = {
  label: string
  tone: BadgeTone
  icon: PolarisIconSource
  iconTone?: IconTone
  description?: string
}

function groupTimelineEvents(events: DesignBuildDetail['events']): TimelineGroup[] {
  const sorted = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const startToday = startOfDay(new Date())
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startToday.getDate() - 1)
  const buckets: Record<TimelineGroupLabel, DesignBuildDetail['events']> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  }
  sorted.forEach(event => {
    const created = new Date(event.createdAt)
    let bucket: TimelineGroupLabel = 'Earlier'
    if (created >= startToday) {
      bucket = 'Today'
    } else if (created >= startYesterday) {
      bucket = 'Yesterday'
    }
    buckets[bucket].push(event)
  })
  return (['Today', 'Yesterday', 'Earlier'] as const)
    .map(label => ({ label, events: buckets[label] }))
    .filter(group => group.events.length)
}

function describeTimelineEvent(event: DesignBuildDetail['events'][number]): TimelineEventMeta {
  switch (event.eventType) {
    case 'NOTE':
      return { label: 'Note added', tone: 'info', icon: NoteIcon, iconTone: 'info' }
    case 'STATUS_CHANGE':
      return { label: 'Status change', tone: 'attention', icon: ClockIcon, iconTone: 'warning' }
    case 'EXPORT':
      return {
        label: 'Exported',
        tone: 'success',
        icon: ExportIcon,
        iconTone: 'success',
        description: 'Build package exported to S3.',
      }
    case 'CUSTOMER_UPDATE':
      return { label: 'Customer update', tone: 'info', icon: ChatIcon, iconTone: 'interactive' }
    case 'FULFILLMENT_UPDATE':
      return { label: 'Fulfillment update', tone: 'info', icon: DeliveryIcon, iconTone: 'info' }
    case 'FILE_ATTACHED':
      return { label: 'File attached', tone: 'new', icon: AttachmentIcon, iconTone: 'info' }
    case 'SLA_BREACH':
      return { label: 'SLA breach', tone: 'critical', icon: AlertCircleIcon, iconTone: 'critical' }
    default:
      return { label: formatEventType(event.eventType), tone: 'info', icon: ClockIcon, iconTone: 'subdued' }
  }
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDate(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  } catch {
    return value
  }
}

function formatWeek(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    return formatter.format(date)
  } catch {
    return value
  }
}

function badgeToneForStatus(status: DesignBuildStatus) {
  switch (status) {
    case 'REVIEW':
      return 'attention'
    case 'APPROVED':
    case 'SCHEDULED':
      return 'success'
    case 'IN_PROGRESS':
      return 'info'
    case 'FULFILLED':
      return 'success'
    case 'BLOCKED':
      return 'critical'
    default:
      return 'info'
  }
}

function formatFulfillmentMode(mode: DesignBuildSummary['fulfillmentMode']) {
  if (mode === 'SUPPLIER_BUILD') return 'Supplier build'
  return 'RBP build'
}

function formatRole(role: string) {
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

function formatTime(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return value
  }
}
