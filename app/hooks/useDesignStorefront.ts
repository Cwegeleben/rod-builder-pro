import { useEffect, useMemo, useState } from 'react'
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
