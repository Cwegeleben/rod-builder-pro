import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DesignBuildStatus } from '@prisma/client'
import type {
  DesignStorefrontConfig,
  DesignStorefrontOption,
  DesignStorefrontPartRole,
} from '../lib/designStudio/storefront.mock'
import type { CompatibilityIssue } from '../lib/designStudio/compatibility'
import {
  serializeCompatibilityContext,
  type DesignStorefrontCompatibilityContext,
} from '../lib/designStudio/compatibility'

export type DesignStorefrontRequestOptions = {
  shopDomain?: string | null
  themeRequest?: boolean
  themeSectionId?: string | null
}

export function appendDesignStudioParams(params: URLSearchParams, options?: DesignStorefrontRequestOptions) {
  if (!options) return
  if (options.shopDomain) {
    params.set('shop', options.shopDomain)
  }
  if (options.themeRequest) {
    params.set('rbp_theme', '1')
  }
  if (options.themeSectionId) {
    params.set('rbp_theme_section', options.themeSectionId)
  }
}

export type UseDesignConfigResult = {
  data: DesignStorefrontConfig | null
  loading: boolean
  error: Error | null
}

export type UseDesignOptionsResult = {
  data: DesignStorefrontOption[]
  issues: CompatibilityIssue[]
  loading: boolean
  error: Error | null
}

export type DesignStorefrontActiveBuild = {
  reference: string
  status: DesignBuildStatus
  submittedAt: string | null
  updatedAt: string
  blankTitle: string | null
  blankSku: string | null
  pricing: {
    subtotal: number
    basePrice: number
    selectedParts: number
    totalParts: number
  }
  components: Array<{ title: string | null; role: string | null; price: number }>
}

export type UseDesignActiveBuildResult = {
  data: DesignStorefrontActiveBuild | null
  loading: boolean
  error: Error | null
  refresh: () => void
}

export type DesignStorefrontTimelineBuild = {
  id: string
  reference: string
  status: DesignBuildStatus
  blankSku: string | null
  updatedAt: string
}

export type UseDesignBuildTimelineResult = {
  data: DesignStorefrontTimelineBuild[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

export function useDesignConfig(options?: DesignStorefrontRequestOptions): UseDesignConfigResult {
  const [data, setData] = useState<DesignStorefrontConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    appendDesignStudioParams(params, options)
    const query = params.toString()
    return query ? `/api/design-studio/config?${query}` : '/api/design-studio/config'
  }, [options?.shopDomain, options?.themeRequest, options?.themeSectionId])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function fetchConfig() {
      setLoading(true)
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load storefront config: ${response.status}`)
        }
        const payload = (await response.json()) as { config?: DesignStorefrontConfig | null }
        if (cancelled) return
        setData(payload.config ?? null)
        setError(null)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error('Unable to load config'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchConfig()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [endpoint])

  return useMemo(() => ({ data, loading, error }), [data, loading, error])
}

export function useDesignOptions(
  role: DesignStorefrontPartRole | null,
  options?: DesignStorefrontRequestOptions,
  compatibilityContext?: DesignStorefrontCompatibilityContext | null,
): UseDesignOptionsResult {
  const [data, setData] = useState<DesignStorefrontOption[]>([])
  const [issues, setIssues] = useState<CompatibilityIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const serializedCompatibility = useMemo(
    () => serializeCompatibilityContext(compatibilityContext ?? null),
    [compatibilityContext],
  )

  useEffect(() => {
    if (!role) {
      setData([])
      setIssues([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const selectedRole = role
    async function fetchOptions(currentRole: DesignStorefrontPartRole) {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('role', currentRole)
        appendDesignStudioParams(params, options)
        if (serializedCompatibility) {
          params.set('compat', serializedCompatibility)
        }
        const response = await fetch(`/api/design-studio/options?${params.toString()}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load options (${response.status})`)
        }
        const payload = (await response.json()) as {
          options?: DesignStorefrontOption[]
          issues?: CompatibilityIssue[]
        }
        if (cancelled) return
        setData(payload.options ?? [])
        setIssues(payload.issues ?? [])
        setError(null)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error('Unable to load options'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchOptions(selectedRole)
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [role, options?.shopDomain, options?.themeRequest, options?.themeSectionId, serializedCompatibility])

  return useMemo(() => ({ data, issues, loading, error }), [data, issues, loading, error])
}

export function useDesignActiveBuild(options?: DesignStorefrontRequestOptions): UseDesignActiveBuildResult {
  const [data, setData] = useState<DesignStorefrontActiveBuild | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    appendDesignStudioParams(params, options)
    const query = params.toString()
    return query ? `/api/design-studio/builds/active?${query}` : '/api/design-studio/builds/active'
  }, [options?.shopDomain, options?.themeRequest, options?.themeSectionId])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function fetchActiveBuild() {
      setLoading(true)
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load active build (${response.status})`)
        }
        const payload = (await response.json()) as { build?: DesignStorefrontActiveBuild | null }
        if (cancelled) return
        setData(payload.build ?? null)
        setError(null)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error('Unable to load build summary'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchActiveBuild()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [endpoint, refreshToken])

  const refresh = useCallback(() => setRefreshToken(token => token + 1), [])

  return useMemo(() => ({ data, loading, error, refresh }), [data, loading, error, refresh])
}

const TIMELINE_STATUS_PARAMS: DesignBuildStatus[] = ['APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'FULFILLED']

export function useDesignBuildTimeline(options?: DesignStorefrontRequestOptions): UseDesignBuildTimelineResult {
  const [data, setData] = useState<DesignStorefrontTimelineBuild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    appendDesignStudioParams(params, options)
    TIMELINE_STATUS_PARAMS.forEach(status => params.append('status', status))
    params.set('limit', '3')
    const query = params.toString()
    return query ? `/api/design-studio/builds?${query}` : '/api/design-studio/builds'
  }, [options?.shopDomain, options?.themeRequest, options?.themeSectionId])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function fetchTimeline() {
      setLoading(true)
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load build timeline (${response.status})`)
        }
        const payload = (await response.json()) as { builds?: DesignStorefrontTimelineBuild[] }
        if (cancelled) return
        setData(payload.builds ?? [])
        setError(null)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error('Unable to load build timeline'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchTimeline()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [endpoint, refreshToken])

  const refresh = useCallback(() => setRefreshToken(token => token + 1), [])

  return useMemo(() => ({ data, loading, error, refresh }), [data, loading, error, refresh])
}
