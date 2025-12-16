import type { LoaderFunctionArgs, LinksFunction, SerializeFrom } from '@remix-run/node'
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
  type DesignStorefrontActiveBuild,
  type DesignStorefrontTimelineBuild,
  useDesignActiveBuild,
  useDesignBuildTimeline,
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
import { loadLatestActiveDesignBuildSummary } from '../lib/designStudio/builds.server'
import { loadDesignStorefrontConfig } from '../lib/designStudio/storefront.server'
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

type InitialStorefrontSnapshot = {
  hero: { title: string; body: string } | null
  activeBuild: DesignStorefrontActiveBuild | null
  activeBuildResolved: boolean
}

type ThemeExtensionAssets = {
  loaderUrl: string
  manifestUrl: string
  bootUrl: string
  configUrl: string
  debugEnabled: boolean
}

type DraftAutosaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'success'; timestamp: number }
  | { state: 'error'; message: string }

type PendingDraftSubmission = {
  payload: string
  method: 'POST' | 'PUT'
  token: string | null
  fingerprint: string | null
  submissionId: number
}

type DraftLoadResponse = {
  draft: StorefrontBuildPayload | null
  token: string | null
}

type DraftSaveResponse = {
  ok: boolean
  token?: string | null
}

type DesignStudioLoaderData = SerializeFrom<typeof loader>

type BlankDraftFingerprintArgs = {
  blankOptionId: string | null
  reelSeatOptionId?: string | null
  draftToken: string | null
  compatibilityKey?: string | null
}

function buildBlankDraftFingerprint({
  blankOptionId,
  reelSeatOptionId = null,
  draftToken,
  compatibilityKey = null,
}: BlankDraftFingerprintArgs): string | null {
  if (!blankOptionId) return null
  return JSON.stringify({
    blankOptionId,
    reelSeatOptionId,
    draftToken: draftToken ?? null,
    compatibilityKey,
  })
}

type BlankDraftFingerprintPayload = {
  blankOptionId: string | null
  reelSeatOptionId: string | null
  draftToken: string | null
  compatibilityKey: string | null
}

function parseBlankDraftFingerprint(value: string | null): BlankDraftFingerprintPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const blankOptionId = typeof parsed.blankOptionId === 'string' ? parsed.blankOptionId : null
    const draftToken = typeof parsed.draftToken === 'string' ? parsed.draftToken : null
    const reelSeatOptionId = typeof parsed.reelSeatOptionId === 'string' ? parsed.reelSeatOptionId : null
    const compatibilityRaw = parsed.compatibilityKey
    const compatibilityKey = typeof compatibilityRaw === 'string' ? compatibilityRaw : null
    return { blankOptionId, reelSeatOptionId, draftToken, compatibilityKey }
  } catch {
    return null
  }
}

function extractBlankOptionIdFromDraft(draft: StorefrontBuildPayload | null): string | null {
  return extractOptionIdFromDraft(draft, BLANK_ROLE)
}

function extractOptionIdFromDraft(draft: StorefrontBuildPayload | null, role: DesignStorefrontPartRole): string | null {
  if (!draft?.selections?.length) return null
  const selection = draft.selections.find(entry => entry.role === role)
  return selection?.option?.id ?? null
}

declare global {
  interface Window {
    __ENABLE_DS_DEBUG__?: boolean
  }
}

type BuildSaveResponse = {
  ok: boolean
  reference?: string
  error?: string
}

const BLANK_ROLE: DesignStorefrontPartRole = 'blank'
const REEL_SEAT_ROLE: DesignStorefrontPartRole = 'reel_seat'

const DEFAULT_HERO_CONTENT = {
  title: 'Design Studio',
  body: 'Curated storefront components for Rainshadow builds.',
} as const

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
  const themeAssets = isThemeRequest ? buildThemeExtensionAssets(url) : null
  const initialStorefront: InitialStorefrontSnapshot = {
    hero: null,
    activeBuild: null,
    activeBuildResolved: false,
  }
  if (designStudioAccess.enabled) {
    const configPromise = loadDesignStorefrontConfig(designStudioAccess).catch(error => {
      console.error('[designStudio] Failed to preload storefront config', error)
      return null
    })
    const activeBuildPromise = designStudioAccess.shopDomain
      ? loadLatestActiveDesignBuildSummary(designStudioAccess.shopDomain)
          .then(build => ({ build, resolved: true }))
          .catch(error => {
            console.error('[designStudio] Failed to preload active build summary', error)
            return { build: null, resolved: false }
          })
      : Promise.resolve({ build: null, resolved: false })
    const [configResult, activeBuildResult] = await Promise.all([configPromise, activeBuildPromise])
    initialStorefront.hero = configResult?.hero ?? null
    initialStorefront.activeBuild = activeBuildResult.build
    initialStorefront.activeBuildResolved = activeBuildResult.resolved
  }
  const frameAncestors = buildFrameAncestors(designStudioAccess.shopDomain)
  const storefrontBlankDraftEnabled = process.env.DESIGN_STUDIO_PHASE3_BLANK === '1'
  const storefrontReelSeatDraftEnabled = process.env.DESIGN_STUDIO_PHASE3_REEL_SEAT === '1'
  console.warn('[designStudio] storefront blank loader flag', {
    storefrontBlankDraftEnabled,
    phase3Env: process.env.DESIGN_STUDIO_PHASE3_BLANK,
  })
  console.warn('[designStudio] storefront reel seat loader flag', {
    storefrontReelSeatDraftEnabled,
    phase32Env: process.env.DESIGN_STUDIO_PHASE3_REEL_SEAT,
  })
  return json(
    {
      designStudioAccess,
      requestContext,
      initialStorefront,
      storefrontBlankDraftEnabled,
      storefrontReelSeatDraftEnabled,
      themeAssets,
    },
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

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i

function buildThemeExtensionAssets(url: URL): ThemeExtensionAssets {
  const params = new URLSearchParams(url.search)
  const pathPrefixParam = params.get('path_prefix')
  const query = params.toString()
  const suffix = query ? `?${query}` : ''
  const proxyBase = normalizeThemeProxyPrefix(pathPrefixParam)
  const designBase = `${proxyBase}/design`
  const shopOrigin = normalizeShopOrigin(url.searchParams.get('shop'))
  const bootPath = `${designBase}/boot${suffix}`
  const configPath = `${designBase}/config${suffix}`
  return {
    loaderUrl: '/resources/design-studio/assets/design-studio-loader.js',
    manifestUrl: '/resources/design-studio/assets/design-studio-ui.manifest.json',
    bootUrl: shopOrigin ? `${shopOrigin}${bootPath}` : bootPath,
    configUrl: shopOrigin ? `${shopOrigin}${configPath}` : configPath,
    debugEnabled: url.searchParams.get('ds_debug') === '1',
  }
}

function normalizeThemeProxyPrefix(rawValue: string | null): string {
  const fallback = '/apps/proxy'
  if (!rawValue) return fallback
  let decoded: string = rawValue
  try {
    decoded = decodeURIComponent(rawValue)
  } catch {
    decoded = rawValue
  }
  if (!decoded.startsWith('/')) {
    decoded = `/${decoded}`
  }
  decoded = decoded.replace(/\/+/g, '/')
  if (decoded.length > 1 && decoded.endsWith('/')) {
    decoded = decoded.replace(/\/+$/, '')
  }
  return decoded || fallback
}

function normalizeShopOrigin(shopDomain: string | null): string | null {
  if (!shopDomain) return null
  const trimmed = shopDomain.trim()
  if (!SHOP_DOMAIN_PATTERN.test(trimmed)) {
    return null
  }
  return `https://${trimmed.toLowerCase()}`
}

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: polarisStyles }]

export default function DesignStudioStorefrontRoute() {
  const loaderData = useLoaderData<typeof loader>()
  const themeRequest = loaderData.requestContext.source === 'theme-extension'
  if (themeRequest && loaderData.themeAssets) {
    const hero = loaderData.initialStorefront.hero ?? DEFAULT_HERO_CONTENT
    return (
      <ThemeExtensionShell
        designStudioAccess={loaderData.designStudioAccess}
        requestContext={loaderData.requestContext}
        hero={hero}
        themeAssets={loaderData.themeAssets}
      />
    )
  }
  return <DesignStudioInteractiveApp loaderData={loaderData} />
}

function DesignStudioInteractiveApp({ loaderData }: { loaderData: DesignStudioLoaderData }) {
  const {
    designStudioAccess,
    requestContext,
    initialStorefront,
    storefrontBlankDraftEnabled,
    storefrontReelSeatDraftEnabled,
  } = loaderData
  console.log('[designStudio] access payload', {
    shopDomain: designStudioAccess.shopDomain,
    enabled: designStudioAccess.enabled,
    tier: designStudioAccess.tier,
  })
  const themeRequest = requestContext.source === 'theme-extension'
  const blankDraftMode = storefrontBlankDraftEnabled
  const reelSeatDraftEnabled = blankDraftMode && storefrontReelSeatDraftEnabled
  const hydrated = useHydrationReady()
  const requestOptions = useMemo<DesignStorefrontRequestOptions>(
    () => ({
      shopDomain: designStudioAccess.shopDomain,
      themeRequest,
      themeSectionId: requestContext.themeSectionId ?? null,
    }),
    [designStudioAccess.shopDomain, themeRequest, requestContext.themeSectionId],
  )
  const phase3DraftRoles = useMemo(() => {
    const roles = new Set<DesignStorefrontPartRole>([BLANK_ROLE])
    if (reelSeatDraftEnabled) {
      roles.add(REEL_SEAT_ROLE)
    }
    return roles
  }, [reelSeatDraftEnabled])
  const draftStorageKey = designStudioAccess.shopDomain ? `ds-draft:${designStudioAccess.shopDomain}` : null
  const draftPayloadStorageKey = draftStorageKey ? `${draftStorageKey}:payload` : null
  const { data: config, loading: configLoading } = useDesignConfig(requestOptions)
  const [statusToast, setStatusToast] = useState<StatusToast | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<DesignStorefrontPartRole | null>(null)
  const [selections, setSelections] = useState<
    Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>
  >({})
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({ status: 'idle' })
  const [validationEntries, setValidationEntries] = useState<DesignStudioValidationEntry[]>([])
  const [validationUpdatedAt, setValidationUpdatedAt] = useState<string | null>(null)
  const [draftToken, setDraftToken] = useState<string | null>(null)
  const [draftHydrated, setDraftHydrated] = useState(() => !draftStorageKey)
  const [draftAutosaveStatus, setDraftAutosaveStatus] = useState<DraftAutosaveStatus>({ state: 'idle' })
  const autosaveStatusResetRef = useRef<number | null>(null)
  const incompatibleSelectionsRef = useRef<Set<string>>(new Set())
  const pendingDraftSubmissionRef = useRef<PendingDraftSubmission | null>(null)
  const lastSavedFingerprintRef = useRef<string | null>(null)
  const lastSubmittedFingerprintRef = useRef<string | null>(null)
  const lastSubmissionIdRef = useRef(0)
  const lastDraftPayloadRef = useRef<string | null>(null)
  const draftLoadRequestedRef = useRef(false)
  const draftLoadInitKeyRef = useRef<string | null>(null)
  const saveFetcher = useFetcher<BuildSaveResponse>()
  const draftLoadFetcher = useFetcher<DraftLoadResponse>()
  const [draftSaveBusy, setDraftSaveBusy] = useState(false)
  const draftSaveAbortControllerRef = useRef<AbortController | null>(null)
  useEffect(() => {
    draftLoadRequestedRef.current = false
    draftLoadInitKeyRef.current = null
  }, [draftStorageKey])

  const {
    data: activeBuild,
    loading: activeBuildLoading,
    error: activeBuildError,
    refresh: refreshActiveBuild,
  } = useDesignActiveBuild(requestOptions)
  const {
    data: timelineBuilds,
    loading: timelineLoading,
    error: timelineError,
    refresh: refreshTimeline,
  } = useDesignBuildTimeline(requestOptions)
  const steps = config?.steps ?? []
  const orderedRoles = useMemo(() => steps.flatMap(step => step.roles), [steps])
  const roleStepMap = useMemo(() => {
    const map = new Map<DesignStorefrontPartRole, string>()
    steps.forEach(step => {
      step.roles.forEach(role => map.set(role, step.id))
    })
    return map
  }, [steps])

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

  const { data: options, loading: optionsLoading } = useDesignOptions(
    blankDraftMode ? BLANK_ROLE : activeRole,
    requestOptions,
    blankDraftMode ? null : compatibilityContext,
  )

  const { data: reelSeatOptions, loading: reelSeatOptionsLoading } = useDesignOptions(
    reelSeatDraftEnabled ? REEL_SEAT_ROLE : null,
    requestOptions,
    reelSeatDraftEnabled ? compatibilityContext : null,
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

  const handleSelectOption = useCallback(
    (option: DesignStorefrontOption) => {
      if (blankDraftMode && !phase3DraftRoles.has(option.role as DesignStorefrontPartRole)) {
        return
      }
      setSelections(prev => ({ ...prev, [option.role]: option }))
      if (!blankDraftMode) {
        setDrawerOpen(true)
      }
      setSaveFeedback(current => (current.status === 'idle' ? current : { status: 'idle' }))
    },
    [blankDraftMode, phase3DraftRoles],
  )

  const summary = useMemo(
    () =>
      summarizeSelections(
        selections,
        config?.basePrice ?? 0,
        steps.flatMap(step => step.roles),
      ),
    [selections, config?.basePrice, steps],
  )

  const blankSelection = (selections[BLANK_ROLE] ?? null) as DesignStorefrontOption | null
  const reelSeatSelection = (selections[REEL_SEAT_ROLE] ?? null) as DesignStorefrontOption | null
  const blankDraftFingerprint = useMemo(() => {
    if (!blankDraftMode) return null
    return buildBlankDraftFingerprint({
      blankOptionId: blankSelection?.id ?? null,
      reelSeatOptionId: reelSeatDraftEnabled ? (reelSeatSelection?.id ?? null) : null,
      draftToken,
    })
  }, [blankDraftMode, blankSelection?.id, draftToken, reelSeatDraftEnabled, reelSeatSelection?.id])

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

  const markAutosaveSuccess = useCallback(() => {
    const timestamp = Date.now()
    setDraftAutosaveStatus({ state: 'success', timestamp })
    if (typeof window === 'undefined') return
    if (window.__ENABLE_DS_DEBUG__) {
      console.log('[designStudio] blank autosave status -> success', { timestamp })
    }
    if (autosaveStatusResetRef.current) {
      window.clearTimeout(autosaveStatusResetRef.current)
    }
    autosaveStatusResetRef.current = window.setTimeout(() => {
      setDraftAutosaveStatus({ state: 'idle' })
      autosaveStatusResetRef.current = null
    }, 2500)
  }, [])

  const markAutosaveError = useCallback((message: string) => {
    if (typeof window === 'undefined') return setDraftAutosaveStatus({ state: 'error', message })
    if (autosaveStatusResetRef.current) {
      window.clearTimeout(autosaveStatusResetRef.current)
      autosaveStatusResetRef.current = null
    }
    if (window.__ENABLE_DS_DEBUG__) {
      console.log('[designStudio] blank autosave status -> error', { message })
    }
    setDraftAutosaveStatus({ state: 'error', message })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!draftStorageKey) {
      setDraftHydrated(true)
      draftLoadInitKeyRef.current = 'no-store'
      return
    }
    const storedToken = window.sessionStorage.getItem(draftStorageKey) ?? window.localStorage.getItem(draftStorageKey)
    const storedPayload = draftPayloadStorageKey ? window.localStorage.getItem(draftPayloadStorageKey) : null
    const loadContextKey = `boot:${draftStorageKey}`
    const canBootstrapFromStorage = !draftLoadRequestedRef.current
    if (storedPayload) {
      lastDraftPayloadRef.current = storedPayload
      if (blankDraftMode && canBootstrapFromStorage) {
        try {
          const parsedSnapshot = JSON.parse(storedPayload) as StorefrontBuildPayload
          const hydrated = hydratePhase3SelectionsFromSnapshot(
            parsedSnapshot,
            setSelections,
            Array.from(phase3DraftRoles),
          )
          if (hydrated) {
            markAutosaveSuccess()
          }
        } catch {
          // Ignore invalid payloads; network load will refresh state
        }
      }
    }
    if (draftLoadInitKeyRef.current === loadContextKey || draftLoadRequestedRef.current) {
      return
    }
    draftLoadInitKeyRef.current = loadContextKey
    if (!storedToken) {
      if (draftPayloadStorageKey && storedPayload) {
        window.localStorage.removeItem(draftPayloadStorageKey)
      }
      setDraftHydrated(true)
      return
    }
    draftLoadRequestedRef.current = true
    setDraftHydrated(false)
    setDraftToken(storedToken)
    const params = new URLSearchParams()
    appendDesignStudioParams(params, requestOptions)
    params.set('token', storedToken)
    draftLoadFetcher.load(`/api/design-studio/drafts?${params.toString()}`)
    // `useFetcher` objects change identity as their state updates; including the fetcher
    // in this dependency array causes an infinite load loop. We only care about the
    // derived storage keys and request params here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blankDraftMode, draftStorageKey, draftPayloadStorageKey, markAutosaveSuccess, phase3DraftRoles, requestOptions])

  const selectionSnapshots = useMemo<StorefrontSelectionSnapshot[]>(() => {
    return Object.entries(selections).reduce<StorefrontSelectionSnapshot[]>((acc, [role, option]) => {
      if (!option) return acc
      if (blankDraftMode && !phase3DraftRoles.has(role as DesignStorefrontPartRole)) {
        return acc
      }
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
  }, [blankDraftMode, phase3DraftRoles, selections])

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

  const submitDraftPayload = useCallback(
    (serialized: string, method: 'POST' | 'PUT', token: string | null, options?: { fingerprint?: string | null }) => {
      const formData = new FormData()
      formData.set('payload', serialized)
      if (token) {
        formData.set('token', token)
      }
      const fingerprint = options?.fingerprint ?? null
      const submissionId = (lastSubmissionIdRef.current += 1)
      const submission: PendingDraftSubmission = {
        payload: serialized,
        method,
        token,
        fingerprint,
        submissionId,
      }
      pendingDraftSubmissionRef.current = submission
      lastSubmittedFingerprintRef.current = fingerprint

      draftSaveAbortControllerRef.current?.abort()
      const controller = new AbortController()
      draftSaveAbortControllerRef.current = controller
      setDraftSaveBusy(true)

      const finalize = () => {
        if (draftSaveAbortControllerRef.current === controller) {
          draftSaveAbortControllerRef.current = null
        }
        setDraftSaveBusy(false)
      }

      fetch(draftsActionUrl, {
        method,
        body: formData,
        signal: controller.signal,
        credentials: 'same-origin',
      })
        .then(async response => {
          const contentType = response.headers.get('Content-Type') ?? ''
          const isJson = contentType.includes('application/json')
          const result = isJson ? ((await response.json()) as DraftSaveResponse) : null
          if (!response.ok || !result?.ok) {
            throw new Error('Draft save failed')
          }
          return result
        })
        .then(result => {
          if (pendingDraftSubmissionRef.current?.submissionId !== submissionId) {
            return
          }
          const nextToken = result.token ?? null
          setDraftToken(nextToken)
          pendingDraftSubmissionRef.current = null
          if (!blankDraftMode) {
            return
          }
          const pendingFingerprintPayload = parseBlankDraftFingerprint(submission.fingerprint)
          const fingerprintBlankOptionId = pendingFingerprintPayload?.blankOptionId ?? null
          const fingerprintReelSeatOptionId = pendingFingerprintPayload?.reelSeatOptionId ?? null
          const savedFingerprint = fingerprintBlankOptionId
            ? buildBlankDraftFingerprint({
                blankOptionId: fingerprintBlankOptionId,
                reelSeatOptionId: fingerprintReelSeatOptionId,
                draftToken: nextToken,
                compatibilityKey: pendingFingerprintPayload?.compatibilityKey ?? null,
              })
            : null
          lastSavedFingerprintRef.current = savedFingerprint
          lastSubmittedFingerprintRef.current = savedFingerprint
          markAutosaveSuccess()
        })
        .catch(error => {
          if ((error as DOMException)?.name === 'AbortError') {
            return
          }
          if (blankDraftMode) {
            markAutosaveError('Unable to save draft. Retry?')
          }
        })
        .finally(finalize)
    },
    [blankDraftMode, draftsActionUrl, markAutosaveError, markAutosaveSuccess, setDraftToken],
  )

  const handleRetryAutosave = useCallback(() => {
    const pending = pendingDraftSubmissionRef.current
    if (!pending) return
    if (blankDraftMode) {
      setDraftAutosaveStatus({ state: 'saving' })
    }
    submitDraftPayload(pending.payload, pending.method, pending.token, {
      fingerprint: pending.fingerprint,
    })
  }, [blankDraftMode, submitDraftPayload])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!draftStorageKey) {
      setDraftHydrated(true)
      draftLoadInitKeyRef.current = 'no-store'
      return
    }
    const storedToken = window.sessionStorage.getItem(draftStorageKey) ?? window.localStorage.getItem(draftStorageKey)
    const storedPayload = draftPayloadStorageKey ? window.localStorage.getItem(draftPayloadStorageKey) : null
    const loadContextKey = `boot:${draftStorageKey}`
    if (draftLoadInitKeyRef.current === loadContextKey || draftLoadRequestedRef.current) {
      return
    }
    draftLoadInitKeyRef.current = loadContextKey
    if (!storedToken) {
      if (draftPayloadStorageKey && storedPayload) {
        window.localStorage.removeItem(draftPayloadStorageKey)
      }
      setDraftHydrated(true)
      return
    }
    if (storedPayload) {
      lastDraftPayloadRef.current = storedPayload
    }
    draftLoadRequestedRef.current = true
    setDraftHydrated(false)
    setDraftToken(storedToken)
    const params = new URLSearchParams()
    appendDesignStudioParams(params, requestOptions)
    params.set('token', storedToken)
    draftLoadFetcher.load(`/api/design-studio/drafts?${params.toString()}`)
    // `useFetcher` objects change identity as their state updates; including the fetcher
    // in this dependency array causes an infinite load loop. We only care about the
    // derived storage keys and request params here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey, draftPayloadStorageKey, requestOptions])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey) return
    if (draftToken) {
      window.sessionStorage.setItem(draftStorageKey, draftToken)
      window.localStorage.setItem(draftStorageKey, draftToken)
    } else {
      window.sessionStorage.removeItem(draftStorageKey)
      window.localStorage.removeItem(draftStorageKey)
      if (draftPayloadStorageKey) {
        window.localStorage.removeItem(draftPayloadStorageKey)
      }
    }
  }, [draftStorageKey, draftPayloadStorageKey, draftToken])

  useEffect(() => {
    if (draftLoadFetcher.state !== 'idle') return
    if (!draftLoadRequestedRef.current && !draftLoadFetcher.data) return
    const { draft, token } = draftLoadFetcher.data ?? { draft: null, token: null }
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
      if (blankDraftMode) {
        const loadedBlankOptionId = extractBlankOptionIdFromDraft(draft)
        const loadedReelSeatOptionId = reelSeatDraftEnabled ? extractOptionIdFromDraft(draft, REEL_SEAT_ROLE) : null
        const loadedFingerprint = buildBlankDraftFingerprint({
          blankOptionId: loadedBlankOptionId,
          reelSeatOptionId: loadedReelSeatOptionId,
          draftToken: token ?? null,
        })
        lastSavedFingerprintRef.current = loadedFingerprint
        lastSubmittedFingerprintRef.current = loadedFingerprint
      }
    }
    setDraftToken(token ?? null)
    draftLoadRequestedRef.current = true
    setDraftHydrated(true)
  }, [blankDraftMode, draftLoadFetcher.state, draftLoadFetcher.data, draftStorageKey, reelSeatDraftEnabled])

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
      lastSavedFingerprintRef.current = null
      lastSubmittedFingerprintRef.current = null
    } else {
      setSaveFeedback({ status: 'error', message: saveFetcher.data.error ?? 'Unable to save build.' })
    }
  }, [saveFetcher.state, saveFetcher.data])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!config || !draftHydrated) return
    const hasSelections = selectionSnapshots.length > 0
    if (!hasSelections && !draftToken) {
      lastDraftPayloadRef.current = null
      if (blankDraftMode) {
        lastSavedFingerprintRef.current = null
        lastSubmittedFingerprintRef.current = null
      }
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
    if (serialized === lastDraftPayloadRef.current) {
      return
    }

    const fingerprint = blankDraftMode ? blankDraftFingerprint : null
    if (blankDraftMode) {
      if (!fingerprint) {
        return
      }
      const pendingFingerprint = lastSubmittedFingerprintRef.current
      const awaitingInitialPost = !draftToken && !lastSavedFingerprintRef.current
      const fetcherBusy = draftSaveBusy
      if (draftAutosaveStatus.state === 'error' && pendingDraftSubmissionRef.current?.fingerprint === fingerprint) {
        return
      }
      if (fetcherBusy && pendingFingerprint === fingerprint) {
        return
      }
      if (!awaitingInitialPost && fingerprint === lastSavedFingerprintRef.current) {
        return
      }
    }

    const runAutosave = () => {
      lastDraftPayloadRef.current = serialized
      if (draftPayloadStorageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(draftPayloadStorageKey, serialized)
      }
      const method: 'POST' | 'PUT' = draftToken ? 'PUT' : 'POST'
      if (window.__ENABLE_DS_DEBUG__) {
        console.log('[designStudio] autosave run', {
          method,
          blankDraftMode,
          selectionCount: selectionSnapshots.length,
          hasToken: Boolean(draftToken),
        })
      }
      if (blankDraftMode) {
        setDraftAutosaveStatus({ state: 'saving' })
      }
      const submissionOptions = blankDraftMode ? { fingerprint } : undefined
      submitDraftPayload(serialized, method, draftToken ?? null, submissionOptions)
    }

    if (blankDraftMode) {
      runAutosave()
      return
    }

    const timeoutId = window.setTimeout(runAutosave, 800)
    return () => window.clearTimeout(timeoutId)
  }, [
    config,
    selectionSnapshots,
    stepSnapshots,
    summary,
    validationSnapshot,
    draftToken,
    submitDraftPayload,
    blankDraftMode,
    draftPayloadStorageKey,
    draftHydrated,
    draftSaveBusy,
    draftAutosaveStatus.state,
    blankDraftFingerprint,
    blankSelection?.id,
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

  const heroContent = config?.hero ?? initialStorefront.hero ?? DEFAULT_HERO_CONTENT
  const headerLoading = hydrated && configLoading && !config?.hero && !initialStorefront.hero
  const activeBuildSnapshot = activeBuild ?? initialStorefront.activeBuild ?? null
  const activeBuildLoadingState = hydrated && activeBuildLoading && !activeBuildSnapshot
  const requiresHydrationForActive = !hydrated && !initialStorefront.activeBuildResolved

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <BlockStack gap="400">
            <Header configLoading={headerLoading} hero={heroContent} tier={config?.tier ?? designStudioAccess.tier} />
            <ActiveBuildSummaryCard
              loading={activeBuildLoadingState}
              error={activeBuildError}
              build={activeBuildSnapshot}
              onRetry={refreshActiveBuild}
              formatCurrency={formatCurrency}
              requiresHydration={requiresHydrationForActive}
            />
            <PublishedBuildTimelineCard
              loading={timelineLoading}
              error={timelineError}
              builds={timelineBuilds}
              onRetry={refreshTimeline}
            />
            {blankDraftMode ? (
              <BlockStack gap="400">
                <BlankSelectionCard
                  hydrated={hydrated}
                  loading={configLoading || optionsLoading}
                  options={options}
                  selectedOptionId={blankSelection?.id ?? null}
                  onSelect={handleSelectOption}
                  autosaveStatus={draftAutosaveStatus}
                  onRetry={handleRetryAutosave}
                  formatCurrency={formatCurrency}
                />
                {reelSeatDraftEnabled ? (
                  <ReelSeatSelectionCard
                    hydrated={hydrated}
                    loading={configLoading || reelSeatOptionsLoading}
                    options={reelSeatOptions}
                    selectedOptionId={reelSeatSelection?.id ?? null}
                    onSelect={handleSelectOption}
                    autosaveStatus={draftAutosaveStatus}
                    onRetry={handleRetryAutosave}
                    formatCurrency={formatCurrency}
                    blankSelected={Boolean(blankSelection)}
                  />
                ) : null}
              </BlockStack>
            ) : (
              <>
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
              </>
            )}
          </BlockStack>
        </div>
        {blankDraftMode ? null : (
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
        )}
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

type StatusToast = {
  tone: 'warning' | 'critical'
  message: string
}

function Header({ configLoading, hero, tier }: HeaderProps) {
  const resolvedHero = hero ?? DEFAULT_HERO_CONTENT

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text as="h1" variant="headingXl">
              {resolvedHero.title}
            </Text>
            <Text as="p" tone="subdued">
              {resolvedHero.body}
            </Text>
            {configLoading && !hero ? (
              <Text as="span" tone="subdued" variant="bodySm">
                Updating Design Studio copy; refresh once assets load.
              </Text>
            ) : null}
          </BlockStack>
          <Badge tone="success">{tier}</Badge>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}

type ActiveBuildSummaryCardProps = {
  loading: boolean
  error: Error | null
  build: DesignStorefrontActiveBuild | null
  onRetry: () => void
  formatCurrency: (value: number) => string
  requiresHydration: boolean
}

function ActiveBuildSummaryCard({
  loading,
  error,
  build,
  onRetry,
  formatCurrency,
  requiresHydration,
}: ActiveBuildSummaryCardProps) {
  if (requiresHydration && !build) {
    return (
      <Card>
        <BlockStack gap="050">
          <Text as="h2" variant="headingMd">
            Active build summary
          </Text>
          <Text as="p" tone="subdued">
            Save a Design Studio build or refresh later to see the latest submission details here.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <BlockStack gap="100">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <BlockStack gap="150">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="025">
              <Text as="h2" variant="headingMd">
                Active build summary
              </Text>
              <Text as="p" tone="critical">
                Unable to load the latest build right now.
              </Text>
            </BlockStack>
            <Button onClick={onRetry}>Retry</Button>
          </InlineStack>
        </BlockStack>
      </Card>
    )
  }

  if (!build) {
    return (
      <Card>
        <BlockStack gap="050">
          <Text as="h2" variant="headingMd">
            Active build summary
          </Text>
          <Text as="p" tone="subdued">
            Publish a Design Studio build to see its status here.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  const badge = STATUS_BADGE_CONTENT[build.status] ?? {
    label: formatStatusFallback(build.status),
    tone: 'info',
  }
  const updatedDisplay = formatTimestamp(build.updatedAt)
  const totalParts = Math.max(build.pricing.totalParts || 0, build.pricing.selectedParts || 0)
  const componentPreview = build.components.slice(0, 3)

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="025">
            <Text as="h2" variant="headingMd">
              Active build summary
            </Text>
            <Text as="p" tone="subdued">
              Latest in-progress Design Studio build for this shop.
            </Text>
          </BlockStack>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </InlineStack>
        <Divider />
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Text as="p" tone="subdued">
              Reference
            </Text>
            <Text as="p" variant="headingSm">
              {build.reference}
            </Text>
          </div>
          <div>
            <Text as="p" tone="subdued">
              Updated
            </Text>
            <Text as="p">{updatedDisplay}</Text>
          </div>
          <div>
            <Text as="p" tone="subdued">
              Subtotal
            </Text>
            <Text as="p" variant="headingSm">
              {formatCurrency(build.pricing.subtotal)}
            </Text>
          </div>
        </div>
        <Divider />
        <BlockStack gap="150">
          <div>
            <Text as="p" tone="subdued">
              Blank
            </Text>
            <Text as="p">{build.blankTitle ?? 'Pending blank selection'}</Text>
            {build.blankSku ? (
              <Text as="span" tone="subdued" variant="bodySm">
                {build.blankSku}
              </Text>
            ) : null}
          </div>
          <InlineStack gap="400" wrap>
            <BlockStack gap="025">
              <Text as="p" tone="subdued">
                Parts locked
              </Text>
              <Text as="p">
                {build.pricing.selectedParts}/{totalParts || build.pricing.selectedParts || 0} parts
              </Text>
            </BlockStack>
            <BlockStack gap="025">
              <Text as="p" tone="subdued">
                Base price
              </Text>
              <Text as="p">{formatCurrency(build.pricing.basePrice)}</Text>
            </BlockStack>
          </InlineStack>
          {componentPreview.length ? (
            <div>
              <Text as="p" tone="subdued">
                Key components
              </Text>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {componentPreview.map((component, index) => {
                  const label = maybeFormatRoleLabel(component.role)
                  return (
                    <li key={`${component.title ?? 'component'}-${index}`} className="pl-1">
                      <span className="font-medium text-slate-900">{component.title ?? 'Component'}</span>
                      {label ? <span className="ml-2 text-slate-500">{label}</span> : null}
                      {typeof component.price === 'number' ? (
                        <span className="ml-2 text-slate-500">{formatCurrency(component.price)}</span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </BlockStack>
      </BlockStack>
    </Card>
  )
}

type PublishedBuildTimelineCardProps = {
  loading: boolean
  error: Error | null
  builds: DesignStorefrontTimelineBuild[]
  onRetry: () => void
}

function PublishedBuildTimelineCard({ loading, error, builds, onRetry }: PublishedBuildTimelineCardProps) {
  const hydrated = useHydrationReady()

  if (!hydrated) {
    return (
      <Card>
        <BlockStack gap="050">
          <Text as="h2" variant="headingMd">
            Published build timeline
          </Text>
          <Text as="p" tone="subdued">
            Timeline available once the Theme Editor assets finish loading.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <BlockStack gap="150">
          <BlockStack gap="025">
            <Text as="h2" variant="headingMd">
              Published build timeline
            </Text>
            <Text as="p" tone="subdued">
              Tracking recent published builds.
            </Text>
          </BlockStack>
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <BlockStack gap="150">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="025">
              <Text as="h2" variant="headingMd">
                Published build timeline
              </Text>
              <Text as="p" tone="critical">
                Unable to load recent builds right now.
              </Text>
            </BlockStack>
            <Button onClick={onRetry}>Retry</Button>
          </InlineStack>
        </BlockStack>
      </Card>
    )
  }

  const rows = builds.slice(0, 3)

  return (
    <Card>
      <BlockStack gap="150">
        <Text as="h2" variant="headingMd">
          Published build timeline
        </Text>
        <Text as="p" tone="subdued">
          Latest approved and in-progress builds for this shop.
        </Text>
        {rows.length === 0 ? (
          <Text as="p" tone="subdued">
            No published builds yet.
          </Text>
        ) : (
          <BlockStack gap="100">
            {rows.map(build => {
              const badge = STATUS_BADGE_CONTENT[build.status] ?? {
                label: formatStatusFallback(build.status),
                tone: 'info' as const,
              }
              return (
                <div key={build.id} className="rounded-xl border border-slate-100 bg-white p-4">
                  <InlineStack align="space-between" wrap>
                    <BlockStack gap="025">
                      <InlineStack gap="200" blockAlign="center" wrap>
                        <Text as="span" variant="headingSm">
                          {build.reference}
                        </Text>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </InlineStack>
                      <Text as="span" tone="subdued">
                        {build.blankSku ? `Blank ${build.blankSku}` : 'Blank pending'}
                      </Text>
                    </BlockStack>
                    <Text as="span" tone="subdued">
                      {formatRelativeTimeFromNow(build.updatedAt)}
                    </Text>
                  </InlineStack>
                </div>
              )
            })}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  )
}

function useHydrationReady(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  return hydrated
}

type StatusBadgeTone = 'info' | 'success' | 'warning' | 'critical' | 'attention'

const STATUS_BADGE_CONTENT: Record<DesignStorefrontActiveBuild['status'], { label: string; tone: StatusBadgeTone }> = {
  DRAFT: { label: 'Draft', tone: 'info' },
  REVIEW: { label: 'Needs review', tone: 'attention' },
  APPROVED: { label: 'Approved', tone: 'success' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  FULFILLED: { label: 'Fulfilled', tone: 'success' },
  ARCHIVED: { label: 'Archived', tone: 'info' },
  BLOCKED: { label: 'Blocked', tone: 'critical' },
}

function formatStatusFallback(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function formatRelativeTimeFromNow(value: string | null): string {
  if (!value) return '—'
  try {
    const target = new Date(value).getTime()
    if (!Number.isFinite(target)) return value
    const now = Date.now()
    const diffMs = Math.max(0, Math.abs(now - target))
    const minutes = Math.floor(diffMs / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return value
  }
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

type ThemeExtensionShellProps = {
  designStudioAccess: DesignStudioLoaderData['designStudioAccess']
  requestContext: DesignStudioLoaderData['requestContext']
  hero: { title: string; body: string }
  themeAssets: ThemeExtensionAssets
}

function ThemeExtensionShell({ designStudioAccess, requestContext, hero, themeAssets }: ThemeExtensionShellProps) {
  const heroTitle = hero?.title ?? DEFAULT_HERO_CONTENT.title
  const heroBody = hero?.body ?? DEFAULT_HERO_CONTENT.body
  const placeholderMessage = designStudioAccess.enabled
    ? 'Loading Design Studio preview…'
    : 'Design Studio is unavailable for this shop. Contact RBP support to enable storefront access.'
  const sectionId = requestContext.themeSectionId ?? 'app-proxy'
  return (
    <div className="ds-theme-shell" data-ds-theme-request>
      <ThemeShellStyles />
      <section className="ds-theme-shell__frame" aria-live="polite">
        <header className="ds-theme-shell__header">
          <p className="ds-theme-shell__eyebrow">Rod Building Preview</p>
          <h1 className="ds-theme-shell__title">{heroTitle}</h1>
          <p className="ds-theme-shell__subtitle">{heroBody}</p>
        </header>
        <div className="ds-theme-shell__root-wrapper">
          <div
            className="ds-theme-shell__root"
            data-rbp-design-studio-root="true"
            data-rbp-design-studio-boot-url={themeAssets.bootUrl}
            data-rbp-design-studio-manifest-url={themeAssets.manifestUrl}
            data-rbp-design-studio-loader-src={themeAssets.loaderUrl}
            data-rbp-design-studio-config-url={themeAssets.configUrl}
            data-rbp-design-studio-section-id={sectionId}
            data-rbp-design-studio-state="server"
            data-rbp-design-studio-debug={themeAssets.debugEnabled ? '1' : '0'}
          >
            <div className="ds-theme-shell__placeholder" data-rbp-design-studio-message>
              {placeholderMessage}
            </div>
            <div className="ds-theme-shell__app-root" data-rbp-design-studio-app-root />
            <noscript>
              <div className="ds-theme-shell__noscript">
                Enable JavaScript in your browser to interact with Design Studio.
              </div>
            </noscript>
          </div>
        </div>
      </section>
      {themeAssets.debugEnabled ? (
        <>
          <ThemeDiagnosticsPanel
            designStudioAccess={designStudioAccess}
            requestContext={requestContext}
            themeAssets={themeAssets}
          />
          <EnableThemeDebugFlag />
        </>
      ) : null}
      <script src={themeAssets.loaderUrl} defer data-rbp-design-studio-loader />
    </div>
  )
}

type ThemeDiagnosticsPanelProps = {
  designStudioAccess: DesignStudioLoaderData['designStudioAccess']
  requestContext: DesignStudioLoaderData['requestContext']
  themeAssets: ThemeExtensionAssets
}

function ThemeDiagnosticsPanel({ designStudioAccess, requestContext, themeAssets }: ThemeDiagnosticsPanelProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Shop domain', value: designStudioAccess.shopDomain ?? 'unknown' },
    { label: 'Access enabled', value: designStudioAccess.enabled ? 'true' : 'false' },
    { label: 'Theme section id', value: requestContext.themeSectionId ?? 'app-proxy' },
    { label: 'Loader asset', value: themeAssets.loaderUrl },
    { label: 'Manifest asset', value: themeAssets.manifestUrl },
    { label: 'Boot endpoint', value: themeAssets.bootUrl },
  ]
  return (
    <aside className="ds-theme-shell__debug" data-rbp-design-studio-debug-panel>
      <h2>Design Studio diagnostics</h2>
      <p>
        Showing because <code>ds_debug=1</code> is present.
      </p>
      <dl>
        {rows.map(row => (
          <div key={row.label} className="ds-theme-shell__debug-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="ds-theme-shell__debug-note">
        Loader state changes update <code>data-rbp-design-studio-state</code> on the root. Watch for
        <q>mounted</q> to confirm the Shopify bundle took over.
      </p>
    </aside>
  )
}

function EnableThemeDebugFlag() {
  return <script dangerouslySetInnerHTML={{ __html: 'window.__ENABLE_DS_DEBUG__ = true;' }} />
}

const THEME_SHELL_STYLES = `
.ds-theme-shell { background: #f8fafc; color: #0f172a; min-height: 100vh; }
.ds-theme-shell__frame { max-width: 960px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
.ds-theme-shell__header { margin-bottom: 1.5rem; }
.ds-theme-shell__eyebrow { margin: 0 0 0.5rem; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem; color: rgba(15,23,42,0.6); }
.ds-theme-shell__title { margin: 0; font-size: 2.25rem; line-height: 1.2; }
.ds-theme-shell__subtitle { margin: 0.75rem 0 0; color: rgba(15,23,42,0.75); max-width: 48ch; }
.ds-theme-shell__root-wrapper { background: #fff; border-radius: 20px; border: 1px solid rgba(15,23,42,0.08); box-shadow: 0 20px 50px rgba(15,23,42,0.12); padding: 1.25rem; }
.ds-theme-shell__root { position: relative; min-height: 420px; border-radius: 16px; border: 1px dashed rgba(15,23,42,0.15); overflow: hidden; }
.ds-theme-shell__placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; font-size: 1rem; color: rgba(15,23,42,0.6); background: linear-gradient(135deg, rgba(148,163,184,0.12), rgba(241,245,249,0.65)); }
.ds-theme-shell__app-root { position: relative; min-height: 100%; z-index: 1; }
.ds-theme-shell__noscript { padding: 1rem; background: #fffaf0; color: #92400e; font-weight: 600; }
.ds-theme-shell__debug { max-width: 960px; margin: 1.5rem auto 3rem; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid rgba(99,102,241,0.35); background: rgba(99,102,241,0.08); }
.ds-theme-shell__debug h2 { margin: 0 0 0.5rem; font-size: 1.15rem; }
.ds-theme-shell__debug dl { margin: 0; display: grid; grid-template-columns: minmax(0, 160px) 1fr; gap: 0.35rem 1rem; }
.ds-theme-shell__debug-row { display: contents; }
.ds-theme-shell__debug dt { font-weight: 600; color: rgba(15,23,42,0.85); }
.ds-theme-shell__debug dd { margin: 0; color: rgba(15,23,42,0.75); word-break: break-all; }
.ds-theme-shell__debug-note { margin: 0.75rem 0 0; font-size: 0.9rem; color: rgba(15,23,42,0.75); }
@media (max-width: 640px) {
  .ds-theme-shell__frame { padding: 2rem 1rem 3rem; }
  .ds-theme-shell__title { font-size: 1.75rem; }
  .ds-theme-shell__root-wrapper { padding: 1rem; }
  .ds-theme-shell__debug dl { grid-template-columns: 1fr; }
}
`

function ThemeShellStyles() {
  return <style dangerouslySetInnerHTML={{ __html: THEME_SHELL_STYLES }} />
}

type BlankSelectionCardProps = {
  hydrated: boolean
  loading: boolean
  options: DesignStorefrontOption[]
  selectedOptionId: string | null
  onSelect: (option: DesignStorefrontOption) => void
  autosaveStatus: DraftAutosaveStatus
  onRetry: () => void
  formatCurrency: (value: number) => string
}

function BlankSelectionCard({
  hydrated,
  loading,
  options,
  selectedOptionId,
  onSelect,
  autosaveStatus,
  onRetry,
  formatCurrency,
}: BlankSelectionCardProps) {
  if (!hydrated) {
    return (
      <Card>
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            Select a blank
          </Text>
          <Text as="p" tone="subdued">
            Enable JavaScript to build a draft. This view stays read-only without it.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <BlockStack gap="150">
          <Text as="h2" variant="headingMd">
            Select a blank
          </Text>
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>
    )
  }

  const blankOptions = options.filter(option => option.role === BLANK_ROLE)

  return (
    <Card>
      <BlockStack gap="150">
        <BlockStack gap="025">
          <Text as="h2" variant="headingMd">
            Select a blank
          </Text>
          <Text as="p" tone="subdued">
            Choose a blank to start your draft. Autosave runs immediately after you pick one.
          </Text>
        </BlockStack>
        <DraftAutosaveIndicator status={autosaveStatus} onRetry={onRetry} testId="blank-draft-status" />
        {blankOptions.length ? (
          <BlockStack gap="100">
            {blankOptions.map(option => {
              const selected = option.id === selectedOptionId
              return (
                <button
                  key={option.id}
                  type="button"
                  data-blank-option={option.id}
                  data-selected={selected ? 'true' : 'false'}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${selected ? 'border-emerald-500 bg-white shadow-sm' : 'border-slate-200 bg-white/80 hover:border-emerald-200'}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(option)}
                >
                  <BlockStack gap="025">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="headingSm" tone={selected ? undefined : 'subdued'}>
                        {option.title}
                      </Text>
                      {selected ? (
                        <Badge tone="success" icon={ClipboardCheckIcon}>
                          Draft selection
                        </Badge>
                      ) : null}
                    </InlineStack>
                    {option.sku ? (
                      <Text as="span" tone="subdued">
                        {option.sku}
                      </Text>
                    ) : null}
                    {typeof option.price === 'number' ? (
                      <Text as="span" tone="subdued" variant="bodySm">
                        MSRP {formatCurrency(option.price)}
                      </Text>
                    ) : null}
                  </BlockStack>
                </button>
              )
            })}
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">
            No blanks available yet.
          </Text>
        )}
      </BlockStack>
    </Card>
  )
}

type ReelSeatSelectionCardProps = {
  hydrated: boolean
  loading: boolean
  options: DesignStorefrontOption[]
  selectedOptionId: string | null
  onSelect: (option: DesignStorefrontOption) => void
  autosaveStatus: DraftAutosaveStatus
  onRetry: () => void
  formatCurrency: (value: number) => string
  blankSelected: boolean
}

function ReelSeatSelectionCard({
  hydrated,
  loading,
  options,
  selectedOptionId,
  onSelect,
  autosaveStatus,
  onRetry,
  formatCurrency,
  blankSelected,
}: ReelSeatSelectionCardProps) {
  if (!hydrated) {
    return (
      <Card>
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            Add a reel seat
          </Text>
          <Text as="p" tone="subdued">
            Enable JavaScript to select supporting components for this draft.
          </Text>
        </BlockStack>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <BlockStack gap="150">
          <Text as="h2" variant="headingMd">
            Add a reel seat
          </Text>
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>
    )
  }

  const reelSeatOptions = options.filter(option => option.role === REEL_SEAT_ROLE)
  const selectionLocked = !blankSelected

  return (
    <Card>
      <BlockStack gap="150">
        <BlockStack gap="025">
          <Text as="h2" variant="headingMd">
            Add a reel seat
          </Text>
          <Text as="p" tone="subdued">
            Pick a reel seat once your blank is saved. Draft autosave keeps blank and reel seat in the same token.
          </Text>
        </BlockStack>
        <DraftAutosaveIndicator status={autosaveStatus} onRetry={onRetry} testId="reelseat-draft-status" />
        {selectionLocked ? (
          <Text as="p" tone="subdued" variant="bodySm">
            Select a blank first to unlock reel seat choices.
          </Text>
        ) : null}
        {reelSeatOptions.length ? (
          <BlockStack gap="100">
            {reelSeatOptions.map(option => {
              const selected = option.id === selectedOptionId
              return (
                <button
                  key={option.id}
                  type="button"
                  data-reel-seat-option={option.id}
                  data-selected={selected ? 'true' : 'false'}
                  disabled={selectionLocked}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                    selectionLocked
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                      : selected
                        ? 'border-emerald-500 bg-white shadow-sm'
                        : 'border-slate-200 bg-white/80 hover:border-emerald-200'
                  }`}
                  aria-pressed={selected}
                  onClick={() => onSelect(option)}
                >
                  <BlockStack gap="025">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="headingSm" tone={selected ? undefined : 'subdued'}>
                        {option.title}
                      </Text>
                      {selected ? (
                        <Badge tone="success" icon={ClipboardCheckIcon}>
                          Draft selection
                        </Badge>
                      ) : null}
                    </InlineStack>
                    {option.sku ? (
                      <Text as="span" tone="subdued">
                        {option.sku}
                      </Text>
                    ) : null}
                    {typeof option.price === 'number' ? (
                      <Text as="span" tone="subdued" variant="bodySm">
                        MSRP {formatCurrency(option.price)}
                      </Text>
                    ) : null}
                  </BlockStack>
                </button>
              )
            })}
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">
            No reel seats available yet.
          </Text>
        )}
      </BlockStack>
    </Card>
  )
}

type DraftAutosaveIndicatorProps = {
  status: DraftAutosaveStatus
  onRetry: () => void
  testId?: string
}

function DraftAutosaveIndicator({ status, onRetry, testId }: DraftAutosaveIndicatorProps) {
  if (status.state === 'saving') {
    return (
      <div data-testid={testId}>
        <Text as="p" tone="subdued" variant="bodySm">
          Saving draft…
        </Text>
      </div>
    )
  }
  if (status.state === 'success') {
    return (
      <div data-testid={testId}>
        <Text as="p" tone="success" variant="bodySm">
          Draft saved
        </Text>
      </div>
    )
  }
  if (status.state === 'error') {
    return (
      <div data-testid={testId}>
        <InlineStack gap="200" blockAlign="center" wrap>
          <Text as="p" tone="critical" variant="bodySm">
            {status.message}
          </Text>
          <Button size="slim" onClick={onRetry} variant="secondary">
            Retry draft save
          </Button>
        </InlineStack>
      </div>
    )
  }
  return null
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

function hydratePhase3SelectionsFromSnapshot(
  snapshot: StorefrontBuildPayload | null,
  setter: SelectionStateSetter,
  roles: DesignStorefrontPartRole[],
): boolean {
  if (!snapshot?.selections?.length || !roles.length) return false
  let hydrated = false
  setter(prev => {
    let nextState = prev
    roles.forEach(role => {
      const entry = snapshot.selections?.find(selection => selection.role === role)
      if (!entry?.option) {
        return
      }
      hydrated = true
      const fallback = nextState[role]
      const nextOption: DesignStorefrontOption = {
        id: entry.option.id,
        role,
        title: entry.option.title,
        price: entry.option.price,
        sku: entry.option.sku ?? undefined,
        vendor: entry.option.vendor ?? undefined,
        notes: entry.option.notes ?? undefined,
        badge: entry.option.badge ?? undefined,
        specs: fallback?.specs ?? [],
        compatibility: entry.option.compatibility ?? fallback?.compatibility ?? null,
        subtitle: fallback?.subtitle ?? undefined,
      }
      nextState = {
        ...nextState,
        [role]: nextOption,
      }
    })
    return hydrated ? nextState : prev
  })
  return hydrated
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

const ROLE_LABEL_MAP: Record<DesignStorefrontPartRole, string> = {
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

function formatRoleLabel(role: DesignStorefrontPartRole) {
  return ROLE_LABEL_MAP[role] || role.replace(/_/g, ' ')
}

function maybeFormatRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null
  const label = (ROLE_LABEL_MAP as Record<string, string | undefined>)[role]
  return label ?? role.replace(/_/g, ' ')
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
