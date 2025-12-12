import type { LoaderFunctionArgs, LinksFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  AppProvider as PolarisAppProvider,
  Badge,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  Tabs,
  Text,
} from '@shopify/polaris'
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url'
import polarisTranslations from '@shopify/polaris/locales/en.json'
import { ClipboardCheckIcon, CartIcon } from '@shopify/polaris-icons'
import { PanelStatusBadge } from '../components/designStudio/PanelStatusBadge'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { summarizeSelections } from '../lib/designStudio/storefront.summary'
import {
  type DesignStorefrontPartRole,
  type DesignStorefrontOption,
  type DesignStorefrontStep,
} from '../lib/designStudio/storefront.mock'
import {
  buildCompatibilityContextFromSelections,
  describeCompatibilityIssue,
  evaluateOptionCompatibility,
  type CompatibilityIssue,
  type DesignStorefrontCompatibilityContext,
} from '../lib/designStudio/compatibility'
import {
  appendDesignStudioParams,
  type DesignStorefrontRequestOptions,
  useDesignConfig,
  useDesignOptions,
} from '../hooks/useDesignStorefront'
import {
  logDesignStudioValidationEvent,
  summarizeValidationEntries,
  type DesignStudioValidationEntry,
  type DesignStudioValidationSeverity,
  type DesignStudioValidationState,
  type DesignStudioValidationTelemetryEvent,
} from '../lib/designStudio/validation'
import type {
  StorefrontBuildPayload,
  StorefrontSelectionSnapshot,
  StorefrontStepSnapshot,
} from '../services/designStudio/storefrontPayload.server'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

type SaveFeedback = {
  status: 'idle' | 'success' | 'error'
  reference?: string
  message?: string
}

type ValidationToast = {
  message: string
  tone: 'warning' | 'critical'
}

type DesignStudioRequestContext = {
  source: 'theme-extension' | 'app-proxy'
  themeSectionId?: string | null
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const isThemeRequest = url.searchParams.get('rbp_theme') === '1'
  const shopParam = url.searchParams.get('shop')
  if (isThemeRequest && !shopParam) {
    throw new Response('Shop parameter required for theme loads', { status: 400 })
  }
  const designStudioAccess = await getDesignStudioAccess(request)
  const requestContext: DesignStudioRequestContext = {
    source: isThemeRequest ? 'theme-extension' : 'app-proxy',
    themeSectionId: url.searchParams.get('rbp_theme_section'),
  }
  const frameAncestors = buildFrameAncestors(designStudioAccess.shopDomain)
  return json(
    { designStudioAccess, requestContext },
    {
      headers: buildShopifyCorsHeaders(request, {
        'Content-Security-Policy': `frame-ancestors ${frameAncestors.join(' ')};`,
        'Cache-Control': 'no-store, must-revalidate',
      }),
    },
  )
}

function buildFrameAncestors(shopDomain: string | null): string[] {
  const ancestors = new Set<string>(['https://admin.shopify.com', 'https://*.myshopify.com', 'https://*.spin.dev'])
  if (shopDomain) {
    ancestors.add(`https://${shopDomain}`)
  }
  return Array.from(ancestors)
}

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: polarisStyles }]

export default function DesignStudioStorefrontRoute() {
  const { designStudioAccess, requestContext } = useLoaderData<typeof loader>()
  const themeRequest = requestContext.source === 'theme-extension'
  const requestOptions = useMemo<DesignStorefrontRequestOptions>(
    () => ({
      shopDomain: designStudioAccess.shopDomain,
      themeRequest,
      themeSectionId: requestContext.themeSectionId ?? null,
    }),
    [designStudioAccess.shopDomain, themeRequest, requestContext.themeSectionId],
  )
  const { data: config, loading: configLoading } = useDesignConfig(requestOptions)
  const saveFetcher = useFetcher<{ ok: boolean; reference?: string; error?: string }>()
  const draftLoadFetcher = useFetcher<{ draft: StorefrontBuildPayload | null; token: string | null }>()
  const draftSaveFetcher = useFetcher<{ ok: boolean; token: string | null }>()
  const steps = config?.steps ?? []
  const [activeStepId, setActiveStepId] = useState<string | null>(steps[0]?.id ?? null)
  const [activeRole, setActiveRole] = useState<DesignStorefrontPartRole | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selections, setSelections] = useState<
    Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>
  >({})
  const [validationEntries, setValidationEntries] = useState<DesignStudioValidationState>([])
  const [validationUpdatedAt, setValidationUpdatedAt] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({ status: 'idle' })
  const [statusToast, setStatusToast] = useState<ValidationToast | null>(null)
  const [draftToken, setDraftToken] = useState<string | null>(null)
  const lastDraftPayloadRef = useRef<string | null>(null)
  const incompatibleSelectionsRef = useRef<Set<string>>(new Set())
  const draftStorageKey = useMemo(
    () => (designStudioAccess.shopDomain ? `ds-draft:${designStudioAccess.shopDomain}` : null),
    [designStudioAccess.shopDomain],
  )

  const roleStepMap = useMemo(() => {
    const map = new Map<DesignStorefrontPartRole, string>()
    steps.forEach(step => {
      step.roles.forEach(role => {
        map.set(role, step.id)
      })
    })
    return map
  }, [steps])

  const orderedRoles = useMemo(() => steps.flatMap(step => step.roles), [steps])

  useEffect(() => {
    if (!statusToast) return
    if (typeof window === 'undefined') return
    const timeoutId = window.setTimeout(() => setStatusToast(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [statusToast])

  const compatibilityContext = useMemo<DesignStorefrontCompatibilityContext | null>(
    () => buildCompatibilityContextFromSelections(selections),
    [selections],
  )

  const buildValidationEntries = useCallback(
    (role: DesignStorefrontPartRole, issues: CompatibilityIssue[], source: 'options' | 'selection') => {
      if (!issues.length) return [] as DesignStudioValidationEntry[]
      const panelId = roleStepMap.get(role) ?? role
      return issues.map(issue => ({
        panelId,
        severity: deriveSeverityFromIssue(issue),
        code: issue.code,
        message: describeCompatibilityIssue(issue),
        role,
        optionId: 'optionId' in issue ? (issue.optionId ?? null) : null,
        source,
      }))
    },
    [roleStepMap],
  )

  const upsertValidationEntries = useCallback(
    (role: DesignStorefrontPartRole, source: 'options' | 'selection', entries: DesignStudioValidationEntry[]) => {
      setValidationEntries(prev => {
        const filtered = prev.filter(entry => !(entry.role === role && entry.source === source))
        const next = entries.length ? [...filtered, ...entries] : filtered
        if (!areValidationEntryListsEqual(prev, next)) {
          setValidationUpdatedAt(next.length ? new Date().toISOString() : null)
        }
        return next
      })
    },
    [setValidationUpdatedAt],
  )

  useEffect(() => {
    if (!steps.length) return
    setActiveStepId(prev => prev ?? steps[0]?.id ?? null)
  }, [steps])

  const activeStep = useMemo(
    () => steps.find(step => step.id === activeStepId) ?? steps[0] ?? null,
    [steps, activeStepId],
  )

  useEffect(() => {
    if (!activeStep) return
    if (!activeRole || !activeStep.roles.includes(activeRole)) {
      setActiveRole(activeStep.roles[0] ?? null)
    }
  }, [activeStep, activeRole])

  useEffect(() => {
    if (!orderedRoles.length) return
    setSelections(prev => {
      const next = { ...prev }
      let changed = false
      orderedRoles.forEach(role => {
        if (!(role in next)) {
          next[role] = null
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [orderedRoles])

  const {
    data: options,
    issues: optionIssues,
    loading: optionsLoading,
  } = useDesignOptions(activeRole, requestOptions, compatibilityContext)

  useEffect(() => {
    if (!activeRole) return
    const entries = buildValidationEntries(activeRole, optionIssues, 'options')
    upsertValidationEntries(activeRole, 'options', entries)
  }, [activeRole, optionIssues, buildValidationEntries, upsertValidationEntries])

  const handleSelectOption = useCallback((option: DesignStorefrontOption) => {
    setSelections(prev => ({ ...prev, [option.role]: option }))
    setDrawerOpen(true)
    setSaveFeedback(current => (current.status === 'idle' ? current : { status: 'idle' }))
  }, [])

  const summary = useMemo(
    () =>
      summarizeSelections(
        selections,
        config?.basePrice ?? 0,
        steps.flatMap(step => step.roles),
      ),
    [selections, config?.basePrice, steps],
  )

  useEffect(() => {
    if (!orderedRoles.length) return
    if (!compatibilityContext?.blank) {
      orderedRoles.forEach(role => {
        upsertValidationEntries(role, 'selection', [])
      })
      incompatibleSelectionsRef.current = new Set()
      return
    }
    const nextIncompatible = new Set<string>()
    orderedRoles.forEach(role => {
      if (role === 'blank') {
        upsertValidationEntries(role, 'selection', [])
        return
      }
      const option = selections[role] ?? null
      if (!option) {
        upsertValidationEntries(role, 'selection', [])
        return
      }
      const evaluation = evaluateOptionCompatibility(option, compatibilityContext)
      if (!evaluation.compatible) {
        const selectionIssue: CompatibilityIssue = { code: 'selection-incompatible', role, optionId: option.id }
        const hasMissingData = evaluation.issues.some(
          issue => issue.code === 'missing-option' || issue.code === 'missing-measurement',
        )
        const entries = buildValidationEntries(role, [selectionIssue, ...evaluation.issues], 'selection')
        upsertValidationEntries(role, 'selection', entries)
        if (!incompatibleSelectionsRef.current.has(option.id)) {
          const eventType: DesignStudioValidationTelemetryEvent['type'] = 'incompatible-selection'
          const eventCode: DesignStudioValidationTelemetryEvent['code'] = eventType
          logDesignStudioValidationEvent({
            type: eventType,
            code: eventCode,
            role,
            optionId: option.id,
            productId: option.productId ?? option.id,
            shopDomain: designStudioAccess.shopDomain ?? undefined,
            metadata: { issues: evaluation.issues.map(describeCompatibilityIssue) },
          })
          setStatusToast({
            tone: hasMissingData ? 'warning' : 'critical',
            message: hasMissingData
              ? `${option.title} needs measurements before we can confirm fit.`
              : `${option.title} might not fit the current blank yet.`,
          })
        }
        nextIncompatible.add(option.id)
      } else {
        upsertValidationEntries(role, 'selection', [])
      }
    })
    incompatibleSelectionsRef.current = nextIncompatible
  }, [
    orderedRoles,
    compatibilityContext,
    selections,
    upsertValidationEntries,
    buildValidationEntries,
    designStudioAccess.shopDomain,
  ])

  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: config?.currency ?? 'USD',
        maximumFractionDigits: 0,
      }).format(value),
    [config?.currency],
  )

  const handleJumpToRole = useCallback(
    (role: DesignStorefrontPartRole) => {
      const stepId = roleStepMap.get(role)
      if (stepId) {
        setActiveStepId(stepId)
        setActiveRole(role)
      }
      setDrawerOpen(false)
    },
    [roleStepMap],
  )

  const handleDismissToast = useCallback(() => setStatusToast(null), [])

  const selectionSnapshots = useMemo<StorefrontSelectionSnapshot[]>(() => {
    return Object.entries(selections).reduce<StorefrontSelectionSnapshot[]>((acc, [role, option]) => {
      if (!option) return acc
      acc.push({
        role: role as DesignStorefrontPartRole,
        option: {
          id: option.id,
          title: option.title,
          price: option.price,
          sku: option.sku ?? undefined,
          vendor: option.vendor ?? undefined,
          notes: option.notes ?? undefined,
          badge: option.badge ?? undefined,
          compatibility: option.compatibility ?? null,
        },
      })
      return acc
    }, [])
  }, [selections])

  const validationSnapshot = useMemo(
    () => ({
      entries: validationEntries,
      hasCompatibilityIssues: validationEntries.length > 0,
      updatedAt: validationEntries.length ? (validationUpdatedAt ?? new Date().toISOString()) : null,
    }),
    [validationEntries, validationUpdatedAt],
  )

  const validationByRole = useMemo(() => {
    const map: Partial<Record<DesignStorefrontPartRole, DesignStudioValidationEntry[]>> = {}
    validationEntries.forEach(entry => {
      if (!entry.role) return
      map[entry.role] = [...(map[entry.role] ?? []), entry]
    })
    return map
  }, [validationEntries])

  const roleValidation = validationByRole

  const stepSnapshots = useMemo<StorefrontStepSnapshot[]>(
    () => steps.map(step => ({ id: step.id, label: step.label, roles: step.roles })),
    [steps],
  )

  const canSaveBuild = selectionSnapshots.length > 0 && !!config

  const buildsActionUrl = useMemo(() => {
    const params = new URLSearchParams()
    appendDesignStudioParams(params, requestOptions)
    const query = params.toString()
    return query ? `/api/design-studio/builds?${query}` : '/api/design-studio/builds'
  }, [requestOptions.shopDomain, requestOptions.themeRequest, requestOptions.themeSectionId])

  const draftsActionUrl = useMemo(() => {
    const params = new URLSearchParams()
    appendDesignStudioParams(params, requestOptions)
    const query = params.toString()
    return query ? `/api/design-studio/drafts?${query}` : '/api/design-studio/drafts'
  }, [requestOptions.shopDomain, requestOptions.themeRequest, requestOptions.themeSectionId])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey) return
    const storedToken = window.localStorage.getItem(draftStorageKey)
    if (!storedToken) return
    setDraftToken(storedToken)
    const params = new URLSearchParams()
    appendDesignStudioParams(params, requestOptions)
    params.set('token', storedToken)
    draftLoadFetcher.load(`/api/design-studio/drafts?${params.toString()}`)
  }, [draftStorageKey, draftLoadFetcher, requestOptions])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey) return
    if (draftToken) {
      window.localStorage.setItem(draftStorageKey, draftToken)
    } else {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [draftStorageKey, draftToken])

  useEffect(() => {
    if (draftSaveFetcher.state !== 'idle' || !draftSaveFetcher.data) return
    if (draftSaveFetcher.data.ok) {
      setDraftToken(draftSaveFetcher.data.token ?? null)
    } else {
      lastDraftPayloadRef.current = null
    }
  }, [draftSaveFetcher.state, draftSaveFetcher.data])

  useEffect(() => {
    if (draftLoadFetcher.state !== 'idle' || !draftLoadFetcher.data) return
    const { draft, token } = draftLoadFetcher.data
    if (draft && Array.isArray(draft.selections)) {
      hydrateSelectionsFromDraft(draft, setSelections)
      lastDraftPayloadRef.current = JSON.stringify(
        buildDraftPayloadSnapshot({
          selections: draft.selections ?? [],
          summary: draft.summary ?? {
            basePrice: 0,
            subtotal: 0,
            selectedParts: 0,
            totalParts: 0,
          },
          steps: draft.steps,
          hero: draft.hero,
          featureFlags: draft.featureFlags,
          validation: draft.validation ?? null,
        }),
      )
      if (draft.validation?.entries?.length) {
        setValidationEntries(draft.validation.entries.map(entry => ({ ...entry, source: entry.source ?? 'draft' })))
      } else {
        setValidationEntries([])
      }
      setValidationUpdatedAt(draft.validation?.updatedAt ?? null)
      setSaveFeedback({ status: 'idle' })
    }
    setDraftToken(token ?? null)
  }, [draftLoadFetcher.state, draftLoadFetcher.data])

  const handleSaveBuild = useCallback(() => {
    if (!selectionSnapshots.length) {
      setSaveFeedback({ status: 'error', message: 'Select at least one component before saving.' })
      return
    }
    if (!config) {
      setSaveFeedback({ status: 'error', message: 'Storefront config not loaded yet.' })
      return
    }
    const payload = buildDraftPayloadSnapshot({
      selections: selectionSnapshots,
      summary: {
        ...summary,
        basePrice: config.basePrice ?? 0,
      },
      steps: stepSnapshots,
      hero: config.hero,
      featureFlags: config.featureFlags,
      validation: validationSnapshot,
    })
    const formData = new FormData()
    formData.set('payload', JSON.stringify(payload))
    if (draftToken) {
      formData.set('draftToken', draftToken)
    }
    setSaveFeedback({ status: 'idle' })
    saveFetcher.submit(formData, { method: 'post', action: buildsActionUrl })
  }, [config, selectionSnapshots, stepSnapshots, summary, validationSnapshot, buildsActionUrl, saveFetcher, draftToken])

  useEffect(() => {
    if (saveFetcher.state !== 'idle' || !saveFetcher.data) return
    if (saveFetcher.data.ok) {
      setSaveFeedback({ status: 'success', reference: saveFetcher.data.reference })
      setDraftToken(null)
      lastDraftPayloadRef.current = null
    } else {
      setSaveFeedback({ status: 'error', message: saveFetcher.data.error ?? 'Unable to save build.' })
    }
  }, [saveFetcher.state, saveFetcher.data])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!config) return
    const hasSelections = selectionSnapshots.length > 0
    if (!hasSelections && !draftToken) {
      lastDraftPayloadRef.current = null
      return
    }
    const payload = buildDraftPayloadSnapshot({
      selections: selectionSnapshots,
      summary: {
        ...summary,
        basePrice: config.basePrice ?? 0,
      },
      steps: stepSnapshots,
      hero: config.hero,
      featureFlags: config.featureFlags,
      validation: validationSnapshot,
    })
    const serialized = JSON.stringify(payload)
    if (serialized === lastDraftPayloadRef.current) return
    const timeoutId = window.setTimeout(() => {
      lastDraftPayloadRef.current = serialized
      const formData = new FormData()
      formData.set('payload', serialized)
      if (draftToken) {
        formData.set('token', draftToken)
      }
      draftSaveFetcher.submit(formData, {
        method: 'post',
        action: draftsActionUrl,
        preventScrollReset: true,
      })
    }, 800)
    return () => window.clearTimeout(timeoutId)
  }, [
    config,
    selectionSnapshots,
    stepSnapshots,
    summary,
    validationSnapshot,
    draftToken,
    draftSaveFetcher,
    draftsActionUrl,
  ])

  if (!designStudioAccess.enabled) {
    return (
      <PolarisAppProvider i18n={polarisTranslations}>
        <div className="mx-auto max-w-3xl px-4 py-12">
          <BlockStack gap="400">
            <BlockStack gap="050">
              <Text as="h1" variant="headingLg">
                Design Studio unavailable
              </Text>
              <Text as="p" tone="subdued">
                This shop is not enrolled in Design Studio yet. Reach out to your RBP partner manager to enable the
                storefront builder preview.
              </Text>
            </BlockStack>
          </BlockStack>
        </div>
      </PolarisAppProvider>
    )
  }

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <BlockStack gap="400">
            <Header configLoading={configLoading} hero={config?.hero} tier={config?.tier ?? designStudioAccess.tier} />
            <InlineStack align="end">
              <Button icon={CartIcon} onClick={() => setDrawerOpen(true)} accessibilityLabel="Open build list">
                {`Build (${summary.selectedParts}/${summary.totalParts} parts - ${formatCurrency(summary.subtotal)})`}
              </Button>
            </InlineStack>
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex-1">
                <ComponentSelector
                  loading={configLoading || !activeStep}
                  steps={steps}
                  activeStep={activeStep}
                  activeRole={activeRole}
                  onStepChange={index => setActiveStepId(steps[index]?.id ?? null)}
                  onRoleChange={setActiveRole}
                  options={options}
                  optionsLoading={optionsLoading}
                  selections={selections}
                  onSelect={handleSelectOption}
                  formatCurrency={formatCurrency}
                  roleValidation={validationByRole}
                />
              </div>
              <div className="hidden w-full max-w-sm md:block">
                <BuildDrawer
                  steps={steps}
                  selections={selections}
                  summary={summary}
                  formatCurrency={formatCurrency}
                  onJumpToRole={handleJumpToRole}
                  onSave={handleSaveBuild}
                  saving={saveFetcher.state !== 'idle'}
                  canSave={canSaveBuild}
                  saveResult={saveFeedback}
                  roleValidation={roleValidation}
                />
              </div>
            </div>
          </BlockStack>
        </div>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          steps={steps}
          selections={selections}
          summary={summary}
          formatCurrency={formatCurrency}
          onJumpToRole={handleJumpToRole}
          onSave={handleSaveBuild}
          saving={saveFetcher.state !== 'idle'}
          canSave={canSaveBuild}
          saveResult={saveFeedback}
          roleValidation={roleValidation}
        />
        {statusToast ? (
          <div className="fixed right-6 bottom-6 z-40 max-w-sm">
            <div
              className={`rounded-2xl px-4 py-3 text-white shadow-lg ${
                statusToast.tone === 'critical' ? 'bg-rose-600' : 'bg-amber-600'
              }`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <p className="text-sm leading-5 font-medium">{statusToast.message}</p>
                <button
                  type="button"
                  className="text-sm font-semibold underline decoration-white/70 decoration-dotted"
                  onClick={handleDismissToast}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PolarisAppProvider>
  )
}

type HeaderProps = {
  configLoading: boolean
  hero?: { title: string; body: string }
  tier: string
}

function Header({ configLoading, hero, tier }: HeaderProps) {
  if (configLoading && !hero) {
    return (
      <Card>
        <BlockStack gap="200">
          <SkeletonDisplayText size="large" />
          <SkeletonBodyText lines={2} />
        </BlockStack>
      </Card>
    )
  }
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text as="h1" variant="headingXl">
              {hero?.title ?? 'Design Studio'}
            </Text>
            <Text as="p" tone="subdued">
              {hero?.body ?? 'Curated storefront components for Rainshadow builds.'}
            </Text>
          </BlockStack>
          <Badge tone="success">{tier}</Badge>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}

type ComponentSelectorProps = {
  loading: boolean
  steps: DesignStorefrontStep[]
  activeStep: DesignStorefrontStep | null
  activeRole: DesignStorefrontPartRole | null
  onStepChange: (index: number) => void
  onRoleChange: (role: DesignStorefrontPartRole) => void
  options: DesignStorefrontOption[]
  optionsLoading: boolean
  selections: Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>
  onSelect: (option: DesignStorefrontOption) => void
  formatCurrency: (value: number) => string
  roleValidation: Partial<Record<DesignStorefrontPartRole, DesignStudioValidationEntry[]>>
}

function ComponentSelector({
  loading,
  steps,
  activeStep,
  activeRole,
  onStepChange,
  onRoleChange,
  options,
  optionsLoading,
  selections,
  onSelect,
  formatCurrency,
  roleValidation,
}: ComponentSelectorProps) {
  if (!activeStep) {
    return (
      <Card>
        <SkeletonBodyText lines={4} />
      </Card>
    )
  }

  const tabs = steps.map(step => ({ id: step.id, content: step.label, accessibilityLabel: step.label }))
  const selectedIndex = Math.max(
    steps.findIndex(step => step.id === activeStep.id),
    0,
  )

  return (
    <Card>
      <BlockStack gap="200">
        <Tabs tabs={tabs} selected={selectedIndex} onSelect={onStepChange} fitted>
          <div className="py-4">
            <BlockStack gap="100">
              {activeStep.description ? (
                <Text as="p" tone="subdued">
                  {activeStep.description}
                </Text>
              ) : null}
              {activeStep.roles.length > 1 ? (
                <RoleSelector
                  roles={activeStep.roles}
                  activeRole={activeRole}
                  onRoleChange={onRoleChange}
                  roleValidation={roleValidation}
                />
              ) : null}
              {activeRole && (roleValidation[activeRole]?.length ?? 0) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                  <BlockStack gap="050">
                    {roleValidation[activeRole]?.map(entry => (
                      <Text
                        key={`${entry.code}-${entry.message}`}
                        as="p"
                        tone={entry.severity === 'error' ? 'critical' : 'subdued'}
                      >
                        {entry.message}
                      </Text>
                    ))}
                  </BlockStack>
                </div>
              ) : null}
              {optionsLoading || loading ? (
                <SkeletonBodyText lines={5} />
              ) : options.length ? (
                <BlockStack gap="100">
                  {options.map(option => {
                    const selected = selections[option.role]?.id === option.id
                    return (
                      <div
                        key={option.id}
                        className={`rounded-xl border p-4 shadow-sm ${selected ? 'border-emerald-400/70' : 'border-slate-100'} bg-white`}
                      >
                        <BlockStack gap="100">
                          <InlineStack align="space-between" wrap>
                            <BlockStack gap="025">
                              <Text as="h3" variant="headingMd">
                                {option.title}
                              </Text>
                              {option.subtitle ? (
                                <Text as="p" tone="subdued">
                                  {option.subtitle}
                                </Text>
                              ) : null}
                              <InlineStack gap="100" wrap>
                                <Badge tone="info">{formatRoleLabel(option.role)}</Badge>
                                {option.badge ? <Badge tone="success">{option.badge}</Badge> : null}
                              </InlineStack>
                            </BlockStack>
                            <BlockStack gap="050" align="end">
                              <Text as="span" variant="headingSm">
                                {formatCurrency(option.price)}
                              </Text>
                              <Button
                                size="slim"
                                variant={selected ? 'primary' : 'secondary'}
                                onClick={() => onSelect(option)}
                              >
                                {selected ? 'Selected' : 'Choose'}
                              </Button>
                            </BlockStack>
                          </InlineStack>
                          <Divider />
                          <InlineStack gap="200" wrap>
                            {option.specs.map(spec => (
                              <BlockStack key={`${option.id}-${spec.label}`} gap="025">
                                <Text as="span" tone="subdued">
                                  {spec.label}
                                </Text>
                                <Text as="span">{spec.value}</Text>
                              </BlockStack>
                            ))}
                          </InlineStack>
                          {option.notes ? (
                            <Text as="p" tone="subdued">
                              {option.notes}
                            </Text>
                          ) : null}
                        </BlockStack>
                      </div>
                    )
                  })}
                </BlockStack>
              ) : (
                <Text as="p" tone={activeRole && (roleValidation[activeRole]?.length ?? 0) ? 'critical' : 'subdued'}>
                  {activeRole && roleValidation[activeRole]?.[0]?.message
                    ? roleValidation[activeRole]?.[0]?.message
                    : 'No options available for this role yet.'}
                </Text>
              )}
            </BlockStack>
          </div>
        </Tabs>
      </BlockStack>
    </Card>
  )
}

type RoleSelectorProps = {
  roles: DesignStorefrontPartRole[]
  activeRole: DesignStorefrontPartRole | null
  onRoleChange: (role: DesignStorefrontPartRole) => void
  roleValidation: Partial<Record<DesignStorefrontPartRole, DesignStudioValidationEntry[]>>
}

function RoleSelector({ roles, activeRole, onRoleChange, roleValidation }: RoleSelectorProps) {
  return (
    <InlineStack gap="100" wrap>
      {roles.map(role => {
        const badge = summarizeValidationEntries(roleValidation[role])
        return (
          <span key={role} className="inline-flex items-center gap-2">
            <Button
              size="slim"
              variant={role === activeRole ? 'primary' : 'secondary'}
              onClick={() => onRoleChange(role)}
            >
              {formatRoleLabel(role)}
            </Button>
            {badge ? (
              <PanelStatusBadge severity={badge.severity} count={badge.count} testId={`role-${role}-badge`} />
            ) : null}
          </span>
        )
      })}
    </InlineStack>
  )
}

type BuildDrawerProps = {
  steps: DesignStorefrontStep[]
  selections: Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>
  summary: ReturnType<typeof summarizeSelections>
  formatCurrency: (value: number) => string
  onJumpToRole: (role: DesignStorefrontPartRole) => void
  onSave: () => void
  saving: boolean
  canSave: boolean
  saveResult: SaveFeedback
  roleValidation: Partial<Record<DesignStorefrontPartRole, DesignStudioValidationEntry[]>>
}

function BuildDrawer({
  steps,
  selections,
  summary,
  formatCurrency,
  onJumpToRole,
  onSave,
  saving,
  canSave,
  saveResult,
  roleValidation,
}: BuildDrawerProps) {
  return (
    <Card>
      <BlockStack gap="200">
        <BlockStack gap="025">
          <Text as="h2" variant="headingMd">
            Build list
          </Text>
          <Text as="p" tone="subdued">
            Change selections at any time. Pricing updates instantly.
          </Text>
        </BlockStack>
        <Divider />
        <BlockStack gap="150">
          {steps.map(step => (
            <BlockStack key={step.id} gap="100">
              <Text as="h3" variant="headingSm">
                {step.label}
              </Text>
              {step.roles.map(role => {
                const selection = selections[role]
                const badge = summarizeValidationEntries(roleValidation[role])
                return (
                  <div key={`${step.id}-${role}`} className="rounded-xl border border-slate-100 bg-white p-4">
                    <InlineStack align="space-between" wrap>
                      <BlockStack gap="025">
                        <InlineStack gap="050" blockAlign="center">
                          <Text as="span" tone="subdued">
                            {formatRoleLabel(role)}
                          </Text>
                          {badge ? (
                            <PanelStatusBadge
                              severity={badge.severity}
                              count={badge.count}
                              testId={`drawer-${role}-badge`}
                            />
                          ) : null}
                        </InlineStack>
                        <Text as="p">{selection?.title ?? 'Not selected'}</Text>
                        {selection ? (
                          <Text as="span" tone="subdued">
                            {formatCurrency(selection.price)}
                          </Text>
                        ) : null}
                      </BlockStack>
                      <Button size="slim" variant="plain" onClick={() => onJumpToRole(role)}>
                        Change
                      </Button>
                    </InlineStack>
                  </div>
                )
              })}
            </BlockStack>
          ))}
        </BlockStack>
        <Divider />
        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" tone="subdued">
              Estimated total
            </Text>
            <Text as="span" variant="headingLg">
              {formatCurrency(summary.subtotal)}
            </Text>
          </InlineStack>
          <Button
            size="large"
            icon={ClipboardCheckIcon}
            variant="primary"
            fullWidth
            onClick={onSave}
            disabled={!canSave || saving}
            loading={saving}
          >
            Save build
          </Button>
          {saveResult.status === 'success' ? (
            <Text as="p" tone="success">
              Build saved · Reference {saveResult.reference ?? 'pending'}
            </Text>
          ) : null}
          {saveResult.status === 'error' ? (
            <Text as="p" tone="critical">
              {saveResult.message ?? 'Unable to save build'}
            </Text>
          ) : null}
        </BlockStack>
      </BlockStack>
    </Card>
  )
}

type MobileDrawerProps = BuildDrawerProps & {
  open: boolean
  onClose: () => void
}

function MobileDrawer({ open, onClose, ...rest }: MobileDrawerProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 md:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">
            Build list
          </Text>
          <Button size="slim" onClick={onClose}>
            Close
          </Button>
        </InlineStack>
        <Divider />
        <div className="mt-4">
          <BuildDrawer {...rest} />
        </div>
      </div>
    </div>
  )
}

type SelectionStateSetter = Dispatch<
  SetStateAction<Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>>
>

function hydrateSelectionsFromDraft(draft: StorefrontBuildPayload, setter: SelectionStateSetter) {
  if (!Array.isArray(draft.selections)) return
  setter(prev => {
    const next = { ...prev }
    draft.selections.forEach(selection => {
      const current = next[selection.role]
      const fallback: DesignStorefrontOption =
        current ??
        ({
          id: selection.option.id,
          role: selection.role,
          title: selection.option.title,
          price: selection.option.price,
          specs: [],
          compatibility: selection.option.compatibility ?? null,
        } as DesignStorefrontOption)
      next[selection.role] = {
        ...fallback,
        id: selection.option.id,
        role: selection.role,
        title: selection.option.title,
        price: selection.option.price,
        sku: selection.option.sku ?? undefined,
        vendor: selection.option.vendor ?? undefined,
        notes: selection.option.notes ?? undefined,
        badge: selection.option.badge ?? undefined,
        specs: fallback.specs ?? [],
        compatibility: selection.option.compatibility ?? fallback.compatibility ?? null,
      }
    })
    return next
  })
}

function buildDraftPayloadSnapshot({
  selections,
  summary,
  steps,
  hero,
  featureFlags,
  validation,
}: {
  selections: StorefrontSelectionSnapshot[]
  summary: StorefrontBuildPayload['summary']
  steps?: StorefrontStepSnapshot[]
  hero?: StorefrontBuildPayload['hero']
  featureFlags?: string[]
  validation?: StorefrontBuildPayload['validation']
}): StorefrontBuildPayload {
  return {
    selections,
    summary,
    steps,
    hero,
    featureFlags: Array.isArray(featureFlags) ? featureFlags : [],
    validation: validation ?? null,
  }
}

function formatRoleLabel(role: DesignStorefrontPartRole) {
  const map: Record<DesignStorefrontPartRole, string> = {
    blank: 'Blank',
    rear_grip: 'Rear grip',
    fore_grip: 'Foregrip',
    reel_seat: 'Reel seat',
    butt_cap: 'Butt cap',
    guide_set: 'Guide set',
    guide: 'Guide',
    tip_top: 'Tip top',
    guide_tip: 'Tip top',
    winding_check: 'Winding check',
    decal: 'Decal',
    handle: 'Handle',
    component: 'Component',
    accessory: 'Accessory',
  }
  return map[role] || role.replace(/_/g, ' ')
}

function deriveSeverityFromIssue(issue: CompatibilityIssue): DesignStudioValidationSeverity {
  if (issue.code === 'no-compatible-options' || issue.code === 'selection-incompatible') {
    return 'error'
  }
  if (issue.code === 'missing-option' || issue.code === 'missing-measurement') {
    return 'warning'
  }
  return 'info'
}

function areValidationEntryListsEqual(a: DesignStudioValidationEntry[], b: DesignStudioValidationEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!isSameValidationEntry(a[i], b[i])) return false
  }
  return true
}

function isSameValidationEntry(a: DesignStudioValidationEntry, b: DesignStudioValidationEntry): boolean {
  return (
    a.panelId === b.panelId &&
    a.code === b.code &&
    a.message === b.message &&
    a.severity === b.severity &&
    (a.role ?? null) === (b.role ?? null) &&
    (a.optionId ?? null) === (b.optionId ?? null) &&
    (a.source ?? 'options') === (b.source ?? 'options')
  )
}
