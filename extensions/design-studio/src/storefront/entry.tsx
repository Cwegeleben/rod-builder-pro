import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

type BootPayload = {
  access: {
    enabled: boolean
    tier: string
    reason: string
    shopDomain: string | null
  }
  requestContext: {
    source: 'theme-extension' | 'app-proxy'
    themeSectionId: string | null
  }
  draft: {
    storageKey: string | null
  }
  meta: {
    generatedAt: string
  }
}

type BootEventDetail = {
  bootUrl: string
  payload: BootPayload
}

type ConfigResponse = {
  config?: {
    hero?: { title?: string; body?: string }
    steps?: Array<{ id: string; label: string; description?: string; roles: string[] }>
  }
  error?: string
}

type DesignConfig = NonNullable<ConfigResponse['config']>
type DesignStep = NonNullable<DesignConfig['steps']>[number]

type ConfigState =
  | { status: 'idle' }
  | { status: 'access-disabled' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DesignConfig }

type RootWithPayload = HTMLElement & {
  __rbpDesignStudioBootPackage?: BootEventDetail
}

type MountRecord = {
  root: Root
  node: HTMLDivElement
}

const mountMap = new WeakMap<HTMLElement, MountRecord>()
const loggedRoots = new WeakSet<HTMLElement>()

function resolveConfigEndpoint(bootUrl: string) {
  const url = new URL(bootUrl, window.location.origin)
  const parts = url.pathname.split('/')
  parts[parts.length - 1] = 'config'
  url.pathname = parts.join('/').replace(/\/+/g, '/').replace(/\/+$/, '')
  return url.toString()
}

function useStorefrontConfig(detail: BootEventDetail): ConfigState {
  const [state, setState] = useState<ConfigState>({ status: 'idle' })
  const endpoint = useMemo(() => resolveConfigEndpoint(detail.bootUrl), [detail.bootUrl])

  useEffect(() => {
    if (!detail.payload.access.enabled) {
      setState({ status: 'access-disabled' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    async function fetchConfig() {
      try {
        const response = await fetch(endpoint, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        const json = (await response.json().catch(() => ({}))) as ConfigResponse
        if (cancelled) return
        if (!response.ok || !json?.config) {
          throw new Error(json?.error || `Config load failed (${response.status})`)
        }
        setState({ status: 'ready', data: json.config })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unable to load Design Studio config.'
        setState({ status: 'error', message })
      }
    }

    fetchConfig()

    return () => {
      cancelled = true
    }
  }, [endpoint, detail.payload.access.enabled])

  return state
}

function logBoot(detail: BootEventDetail, rootEl: HTMLElement) {
  if (loggedRoots.has(rootEl)) return
  loggedRoots.add(rootEl)
  console.info('[DesignStudio] storefront bundle booted', {
    themeSectionId: detail.payload.requestContext.themeSectionId,
    shopDomain: detail.payload.access.shopDomain,
  })
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.08)',
        padding: '1.25rem',
        background: '#fff',
      }}
    >
      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
      <p style={{ margin: '0.5rem 0 0', color: 'rgba(15,23,42,0.75)' }}>{body}</p>
    </div>
  )
}

function HeroCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: '1.75rem',
        background: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
        color: '#fff',
        boxShadow: '0 20px 35px rgba(15,23,42,0.25)',
      }}
    >
      <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1.5 }}>
        Storefront preview
      </p>
      <h3 style={{ margin: '0.35rem 0 0.5rem', fontSize: '1.8rem' }}>{title}</h3>
      <p style={{ margin: 0, maxWidth: 520 }}>{body}</p>
    </div>
  )
}

function StepPreview({ step }: { step: DesignStep }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.08)',
        padding: '1.25rem',
        background: '#fff',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(15,23,42,0.55)', textTransform: 'uppercase' }}>
        First step
      </p>
      <h4 style={{ margin: '0.35rem 0 0.3rem', fontSize: '1.25rem' }}>{step.label}</h4>
      {step.description ? <p style={{ margin: 0, color: 'rgba(15,23,42,0.75)' }}>{step.description}</p> : null}
      <p style={{ margin: '0.4rem 0 0', color: 'rgba(15,23,42,0.55)' }}>Roles: {step.roles.join(', ')}</p>
    </div>
  )
}

function MinimalPreview({ detail }: { detail: BootEventDetail }) {
  const configState = useStorefrontConfig(detail)

  if (!detail.payload.access.enabled || configState.status === 'access-disabled') {
    return (
      <StatusCard
        title="Design Studio unavailable"
        body="This shop is not enrolled yet. Contact RBP support to request storefront access."
      />
    )
  }

  if (configState.status === 'idle' || configState.status === 'loading') {
    return <StatusCard title="Loading curated content" body="Fetching the latest Design Studio configuration…" />
  }

  if (configState.status === 'error') {
    return <StatusCard title="Unable to load" body={configState.message} />
  }

  const heroTitle = configState.data.hero?.title ?? 'Design your Rainshadow build'
  const heroBody =
    configState.data.hero?.body ?? 'Explore curated blanks, components, and finishing touches tailored to your tier.'
  const firstStep = configState.data.steps?.[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <HeroCard title={heroTitle} body={heroBody} />
      {firstStep ? (
        <StepPreview step={firstStep} />
      ) : (
        <StatusCard title="Steps not configured" body="Add steps in tenant settings to preview them here." />
      )}
    </div>
  )
}

function renderPreview(detail: BootEventDetail) {
  return (
    <StrictMode>
      <MinimalPreview detail={detail} />
    </StrictMode>
  )
}

function mountReact(rootEl: HTMLElement, detail: BootEventDetail) {
  const existing = mountMap.get(rootEl)
  if (existing) {
    existing.root.render(renderPreview(detail))
    logBoot(detail, rootEl)
    return
  }
  const providedNode = rootEl.querySelector('[data-rbp-design-studio-app-root]') as HTMLDivElement | null
  const mountNode = providedNode ?? document.createElement('div')
  if (!providedNode) {
    mountNode.className = 'rbp-design-studio-storefront__app'
    rootEl.appendChild(mountNode)
  }
  const root = createRoot(mountNode)
  mountMap.set(rootEl, { root, node: mountNode })
  root.render(renderPreview(detail))
  const placeholder = rootEl.querySelector('[data-rbp-design-studio-message]') as HTMLElement | null
  if (placeholder) {
    placeholder.style.display = 'none'
  }
  rootEl.setAttribute('data-rbp-design-studio-state', 'mounted')
  logBoot(detail, rootEl)
}

function attach(rootEl: RootWithPayload) {
  if (rootEl.dataset.rbpDesignStudioHydrated === '1') return
  rootEl.dataset.rbpDesignStudioHydrated = '1'
  const pending = rootEl.__rbpDesignStudioBootPackage
  if (pending) {
    mountReact(rootEl, pending)
  }
  rootEl.addEventListener('rbp:design-studio:boot', event => {
    const detail = (event as CustomEvent<BootEventDetail>).detail
    rootEl.__rbpDesignStudioBootPackage = detail
    mountReact(rootEl, detail)
  })
}

document.querySelectorAll<RootWithPayload>('[data-rbp-design-studio-root]').forEach(attach)

export {}
