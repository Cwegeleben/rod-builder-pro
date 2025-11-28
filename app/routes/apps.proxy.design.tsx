import type { LoaderFunctionArgs, LinksFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { summarizeSelections } from '../lib/designStudio/storefront.summary'
import {
  type DesignStorefrontPartRole,
  type DesignStorefrontOption,
  type DesignStorefrontStep,
} from '../lib/designStudio/storefront.mock'
import { useDesignConfig, useDesignOptions } from '../hooks/useDesignStorefront'
import type {
  StorefrontBuildPayload,
  StorefrontSelectionSnapshot,
  StorefrontStepSnapshot,
} from '../services/designStudio/storefrontBuild.server'

type SaveFeedback = {
  status: 'idle' | 'success' | 'error'
  reference?: string
  message?: string
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
      headers: {
        'Content-Security-Policy': `frame-ancestors ${frameAncestors.join(' ')};`,
      },
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
  const { designStudioAccess } = useLoaderData<typeof loader>()
  const { data: config, loading: configLoading } = useDesignConfig()
  const saveFetcher = useFetcher<{ ok: boolean; reference?: string; error?: string }>()
  const steps = config?.steps ?? []
  const [activeStepId, setActiveStepId] = useState<string | null>(steps[0]?.id ?? null)
  const [activeRole, setActiveRole] = useState<DesignStorefrontPartRole | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selections, setSelections] = useState<
    Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>
  >({})
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({ status: 'idle' })

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

  const { data: options, loading: optionsLoading } = useDesignOptions(activeRole)

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
        },
      })
      return acc
    }, [])
  }, [selections])

  const stepSnapshots = useMemo<StorefrontStepSnapshot[]>(
    () => steps.map(step => ({ id: step.id, label: step.label, roles: step.roles })),
    [steps],
  )

  const canSaveBuild = selectionSnapshots.length > 0 && !!config

  const handleSaveBuild = useCallback(() => {
    if (!selectionSnapshots.length) {
      setSaveFeedback({ status: 'error', message: 'Select at least one component before saving.' })
      return
    }
    if (!config) {
      setSaveFeedback({ status: 'error', message: 'Storefront config not loaded yet.' })
      return
    }
    const payload: StorefrontBuildPayload = {
      selections: selectionSnapshots,
      summary: {
        ...summary,
        basePrice: config.basePrice ?? 0,
      },
      steps: stepSnapshots,
      hero: config.hero,
      featureFlags: config.featureFlags,
    }
    const formData = new FormData()
    formData.set('payload', JSON.stringify(payload))
    setSaveFeedback({ status: 'idle' })
    saveFetcher.submit(formData, { method: 'post', action: '/api/design-studio/builds' })
  }, [config, selectionSnapshots, stepSnapshots, summary, saveFetcher])

  useEffect(() => {
    if (saveFetcher.state !== 'idle' || !saveFetcher.data) return
    if (saveFetcher.data.ok) {
      setSaveFeedback({ status: 'success', reference: saveFetcher.data.reference })
    } else {
      setSaveFeedback({ status: 'error', message: saveFetcher.data.error ?? 'Unable to save build.' })
    }
  }, [saveFetcher.state, saveFetcher.data])

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
        />
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
                <RoleSelector roles={activeStep.roles} activeRole={activeRole} onRoleChange={onRoleChange} />
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
                <Text as="p" tone="subdued">
                  No options available for this role yet.
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
}

function RoleSelector({ roles, activeRole, onRoleChange }: RoleSelectorProps) {
  return (
    <InlineStack gap="100" wrap>
      {roles.map(role => (
        <Button
          key={role}
          size="slim"
          variant={role === activeRole ? 'primary' : 'secondary'}
          onClick={() => onRoleChange(role)}
        >
          {formatRoleLabel(role)}
        </Button>
      ))}
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
                return (
                  <div key={`${step.id}-${role}`} className="rounded-xl border border-slate-100 bg-white p-4">
                    <InlineStack align="space-between" wrap>
                      <BlockStack gap="025">
                        <Text as="span" tone="subdued">
                          {formatRoleLabel(role)}
                        </Text>
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
